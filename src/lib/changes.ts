/**
 * Making a change.
 *
 * Every edit goes straight to the database and the screens refetch. There is no
 * queue to review and nothing to save: what you did is done.
 *
 * Ids are still minted here rather than on the server. A change carrying its
 * own id is replayable — asking twice for the same task is the same task, not
 * two — which is what makes retrying after a dropped connection safe.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { applyChangeFn } from "#/functions/change.functions";
import { whyBlocked } from "#/lib/depends";
import { errorMessage } from "#/lib/errors";
import { createId, ID_PREFIX } from "#/lib/ids";
import { applyOptimistically, restore, snapshot } from "#/lib/optimistic";
import {
	type OutlineChecklist,
	type OutlineTracker,
	parseChecklistTitle,
} from "#/lib/outline";
import { playChangeSound } from "#/lib/sounds";
import {
	sameTagName,
	sameTrackerName,
	withInlineTag,
	withoutInlineTag,
} from "#/lib/tags/inline-tags";
import { sharedAssignees } from "#/lib/tasks/tasks";
import { useToast } from "#/lib/toasts";
import { useRememberUndo } from "#/lib/undo";
import { queryKeys } from "#/queries/keys";
import type { AccessEntry } from "#/schemas/access";
import { type BatchedChange, type Change, isBatchable } from "#/schemas/change";
import { type Stage, stageOf } from "#/schemas/checklist";
import {
	type DailyWindow,
	type ImageRef,
	todayDateOnly,
} from "#/schemas/common";
import {
	PICKABLE_COLORS,
	type SpecialTag,
	specialTag,
	type Tag,
	type TagColor,
} from "#/schemas/tag";
import { MAX_TASKS_AT_ONCE, type Task, type TaskPatch } from "#/schemas/task";
import type { Tracker, TrackerSummary } from "#/schemas/tracker";

/**
 * Checklists this tab has asked for and the server has not yet confirmed.
 *
 * The app goes straight into a new checklist, drawn before it is written, so a
 * task can be typed into it while its own write is still on the way — and two
 * requests are not guaranteed to arrive in the order they were sent. Anything
 * naming a checklist waits for that checklist to exist first, rather than
 * being refused for naming one that does not.
 */
const creatingChecklists = new Map<string, Promise<unknown>>();

/** The checklist a change needs to find already written, if any. */
function checklistNeeded(change: Change): string | null {
	switch (change.kind) {
		case "checklist.update":
		case "checklist.delete":
		case "task.create":
		case "task.createMany":
		case "task.move":
			return change.checklistId;
		// Every move in one goes to the same checklist.
		case "task.batch":
			return (
				change.changes.find((each) => each.kind === "task.move")?.checklistId ??
				null
			);
		default:
			return null;
	}
}

/**
 * The last change made to each task, not yet settled.
 *
 * Several changes to one task can be made at once — parking it is an edit and
 * then a move, undoing a delete is the task and then the rest of it — and each
 * is drawn the moment it is made. Only the sending waits: a change to a task
 * goes once the one before it has settled, since two requests can arrive in
 * either order and the second may name a task the first has yet to write.
 *
 * Settled, not sent: a change that failed with the connection down waits and
 * is tried again, and everything after it for that task waits with it, or a
 * tick would land before the task it ticks; see `settleChange`.
 */
const sendingTasks = new Map<string, Promise<void>>();

/** Each change's place in that queue, kept across its retries. */
const queued = new WeakMap<
	Change,
	{
		before: Array<Promise<void> | undefined>;
		done: Promise<void>;
		settle: () => void;
	}
>();

/** The tasks a change is about, if it is about any. */
function tasksOf(change: Change): ReadonlyArray<string> {
	switch (change.kind) {
		case "task.create":
		case "task.update":
		case "task.delete":
		case "task.move":
			return [change.taskId];
		case "task.createMany":
			return change.tasks.map((task) => task.taskId);
		case "task.deleteMany":
			return change.taskIds;
		case "task.batch":
			return [...new Set(change.changes.map((each) => each.taskId))];
		default:
			return [];
	}
}

/**
 * Send one change, after any change to the same tasks before it has settled.
 * Its place is taken on the first try and kept through every retry.
 */
async function send(change: Change): Promise<void> {
	const taskIds = tasksOf(change);
	if (taskIds.length === 0) return sendNow(change);

	let place = queued.get(change);
	if (place === undefined) {
		let settle = () => {};
		const done = new Promise<void>((resolve) => {
			settle = resolve;
		});
		place = {
			before: taskIds.map((taskId) => sendingTasks.get(taskId)),
			done,
			settle,
		};
		queued.set(change, place);
		for (const taskId of taskIds) sendingTasks.set(taskId, done);
	}

	// Whatever became of the ones before, this one is still asked for.
	await Promise.all(place.before);
	await sendNow(change);
}

/**
 * A change has landed, or been given up on: what waits on it for its tasks
 * may go now.
 */
function settleChange(change: Change): void {
	const place = queued.get(change);
	if (place === undefined) return;

	place.settle();
	for (const taskId of tasksOf(change)) {
		if (sendingTasks.get(taskId) === place.done) sendingTasks.delete(taskId);
	}
}

/** The checklists a change makes, which changes after it may name. */
function checklistsMade(change: Change): ReadonlyArray<string> {
	switch (change.kind) {
		case "checklist.create":
			return [change.checklistId];
		case "group.import":
		case "group.importInto":
			return change.checklists.map((each) => each.checklistId);
		default:
			return [];
	}
}

/** Send one change, once any checklist it depends on has been written. */
async function sendNow(change: Change): Promise<void> {
	const needed = checklistNeeded(change);
	if (needed !== null) await creatingChecklists.get(needed);

	const request = applyChangeFn({ data: { change } });

	const made = checklistsMade(change);
	if (made.length > 0) {
		// A failed creation reports itself; anything waiting on it then goes
		// ahead and fails on its own terms, which is the honest answer.
		const settled = request.catch(() => {});
		for (const checklistId of made) {
			creatingChecklists.set(checklistId, settled);
		}

		try {
			await request;
		} finally {
			for (const checklistId of made) creatingChecklists.delete(checklistId);
		}
		return;
	}

	await request;
}

/**
 * A move stamped with when it was made, on this browser's clock — which the
 * server does not know — for the line it may write into the task's notes; see
 * `notesAfterMove`. Stamped here, once, so every way of moving a task says
 * when, and a move retried after the connection comes back keeps the moment
 * it was made.
 */
function withMovedAt<T extends Change>(change: T): T {
	if (change.kind === "task.batch") {
		return { ...change, changes: change.changes.map(withMovedAt) };
	}
	if (change.kind !== "task.move" || change.at !== undefined) return change;

	const now = new Date();
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	return {
		...change,
		at: { date: todayDateOnly(now), time: `${hours}:${minutes}` },
	};
}

/**
 * Apply a change: on screen at once, on the server behind it.
 *
 * Everything is invalidated afterwards rather than the one query that changed:
 * deleting a tag touches every task, moving a task touches two lists and a
 * checklist's progress, and working out which is which for each of eighteen
 * operations would be a second copy of the data model to keep in step.
 */
export function useApplyChange() {
	const queryClient = useQueryClient();
	const toast = useToast();
	const undo = useRememberUndo();

	const mutation = useMutation({
		mutationFn: send,

		/*
		 * A change that failed because the connection went is not rolled back and
		 * reported: it is tried again, and with no connection the retry waits for
		 * one. Every change carries its own ids, so sending one twice is safe.
		 */
		retry: () => !navigator.onLine,

		/*
		 * Draw it first, ask afterwards.
		 *
		 * In-flight refetches are cancelled before patching, or one already on its
		 * way back would land on top with the old answer and the change would
		 * appear to undo itself.
		 */
		onMutate: async (change) => {
			await queryClient.cancelQueries();
			const previous = snapshot(queryClient);
			// Worked out from the caches as they still are, since what a change
			// undoes is only knowable before it lands; see `invertChange`.
			undo?.remember(change);
			applyOptimistically(queryClient, change);
			return { previous };
		},

		// The guess was wrong. Put back exactly what was there rather than trying
		// to reverse each patch, which is where this kind of code usually breaks.
		onError: (error, change, context) => {
			if (context?.previous) {
				restore(queryClient, context.previous);

				/*
				 * That snapshot was taken before anything made since, so putting
				 * it back took those off the screen too, though they are still on
				 * their way. They are drawn again over it, in the order they were
				 * made — each that has been drawn once already.
				 */
				const made = queryClient.getMutationCache().getAll();
				const at = made.findIndex((each) => each.state.variables === change);
				if (at >= 0) {
					for (const later of made.slice(at + 1)) {
						if (
							later.state.status === "pending" &&
							later.state.context !== undefined
						) {
							applyOptimistically(queryClient, later.state.variables as Change);
						}
					}
				}
			}
			undo?.forget(change);

			/*
			 * A checklist or tracker that was only ever drawn has no earlier state
			 * to put back — its own caches did not exist to be snapshotted — so
			 * they are emptied instead: the screen showing it asks again and hears
			 * that it does not exist, rather than showing it as if saved.
			 */
			for (const checklistId of checklistsMade(change)) {
				void queryClient.resetQueries({
					queryKey: queryKeys.checklist(checklistId),
					exact: true,
				});
			}
			if (change.kind === "tracker.create") {
				void queryClient.resetQueries({
					queryKey: queryKeys.tracker(change.trackerId),
				});
			}

			toast({ body: errorMessage(error), type: "error", uniqueID: "change" });
		},

		/*
		 * Settled, not success: a failure has just rolled the screen back to a
		 * state that may itself be stale, so both paths want the server's answer.
		 *
		 * Only once nothing else is still saving, though. A refetch sent while
		 * another change is on its way comes back without it, and whatever was
		 * just added blinks out until that change lands too. This change still
		 * counts as saving while it settles, hence one.
		 */
		onSettled: async (_data, _error, change) => {
			settleChange(change);
			if (queryClient.isMutating() === 1) await queryClient.invalidateQueries();
		},
	});

	/*
	 * A task finished before what it waits on is refused here, before it is
	 * drawn or heard, rather than drawn and then taken back; see `whyBlocked`.
	 *
	 * So is anything made with no connection: the page stays readable offline
	 * (see `OfflineBanner`), but a change drawn now could only fail later, or
	 * be lost with the tab.
	 */
	const refusal = useCallback(
		(change: Change) => {
			if (!navigator.onLine) {
				const offline =
					"You’re offline. This can be done once you’re back online.";
				toast({ body: offline, type: "error", uniqueID: "offline" });
				return offline;
			}

			const reason = whyBlocked(queryClient, change);
			if (reason !== null) {
				toast({ body: reason, type: "error", uniqueID: "depends" });
			}
			return reason;
		},
		[queryClient, toast],
	);

	/*
	 * A batch goes without the changes in it that would be refused alone, as
	 * if each had been made by itself: one task of five waiting on another
	 * is left as it is, and the other four are ticked. `null` when nothing in
	 * it is left to make.
	 */
	const withoutBlocked = useCallback(
		(change: Change): Change | null => {
			if (change.kind !== "task.batch") return change;

			const reasons = change.changes.map((each) =>
				whyBlocked(queryClient, each),
			);
			const reason = reasons.find((each) => each !== null);
			if (reason === undefined) return change;

			toast({ body: reason, type: "error", uniqueID: "depends" });
			const kept = change.changes.filter((_, at) => reasons[at] === null);
			return kept.length === 0 ? null : { ...change, changes: kept };
		},
		[queryClient, toast],
	);

	// Heard the moment it is made, as it is drawn; the save follows behind.
	const apply = useCallback(
		(change: Change) => {
			if (refusal(change) !== null) return;
			const made = withoutBlocked(change);
			if (made === null) return;
			playChangeSound(made);
			mutation.mutate(withMovedAt(made));
		},
		[mutation.mutate, refusal, withoutBlocked],
	);

	/** For a caller that needs one change to land before it makes the next. */
	const applyAsync = useCallback(
		(change: Change) => {
			const reason = refusal(change);
			if (reason !== null) return Promise.reject(new Error(reason));
			const made = withoutBlocked(change);
			if (made === null) return Promise.reject(new Error("Nothing to do."));
			playChangeSound(made);
			return mutation.mutateAsync(withMovedAt(made));
		},
		[mutation.mutateAsync, refusal, withoutBlocked],
	);

	return { apply, applyAsync, isSaving: mutation.isPending };
}

export type ApplyChange = (change: Change) => void;

/** `applyAsync`: settles once the server has the change, or has refused it. */
export type ApplyChangeAsync = (change: Change) => Promise<void>;

/* -------------------------------------------------------------------------- */
/* Builders                                                                   */
/* -------------------------------------------------------------------------- */

/*
 * Each of these mints the id its change needs and nothing more. They exist so a
 * screen says what the user did rather than assembling a payload, and so the
 * shape of a change lives in one place per kind.
 */

export type ChecklistValues = {
	title: string;
	description: string;
	startDate: string;
	deadline: string | null;
	/** `HH:MM` on the deadline day; see `Checklist.deadlineTime`. */
	deadlineTime: string | null;
	/** Paced to the same hours every day instead; see `Checklist.dailyWindow`. */
	dailyWindow: DailyWindow | null;
	/** Carried by every task in the checklist; see `Checklist.tagIds`. */
	tagIds: Array<string>;
	/**
	 * In a team, who may do what with it, or `null` for everyone at whatever
	 * their role allows; see `accessSchema`.
	 */
	access: Array<AccessEntry> | null;
	/**
	 * The steps its tasks go through; see `Checklist.stages`. Only when they
	 * change, so saving anything else never moves a task.
	 */
	stages?: Array<Stage>;
	/** Editing only: its pictures, when they changed; see `useImageDraft`. */
	images?: Array<ImageRef>;
};

/**
 * Resolves with the new id once the server has written it, so the caller can
 * go into it knowing it is there; rejects if it was refused.
 *
 * Its title is read for a priority and stages typed into it, which are taken
 * off it; see `parseChecklistTitle`. Stages typed there win over the form's.
 */
export async function createChecklist(
	applyAsync: ApplyChangeAsync,
	values: ChecklistValues,
): Promise<string> {
	const checklistId = createId(ID_PREFIX.checklist);
	const { title, urgent, important, stages } = parseChecklistTitle(
		values.title,
	);
	await applyAsync({
		kind: "checklist.create",
		checklistId,
		...values,
		title,
		urgent,
		important,
		...(stages === undefined ? {} : { stages }),
	});
	return checklistId;
}

export function createTask(
	apply: ApplyChange,
	input: {
		checklistId: string | null;
		title: string;
		tagIds: Array<string>;
		/** A tracker this task should follow rather than be ticked. */
		trackerId?: string | null;
		/** Another checklist this task stands for, done when that one is. */
		linkedChecklistId?: string | null;
		/** Typed as `-u`, `-i` or `-ui` at the end of the line. */
		urgent?: boolean;
		important?: boolean;
		/** Typed as `-deadline`; see `readDeadline`. */
		deadline?: string | null;
		deadlineTime?: string | null;
	},
): string {
	const taskId = createId(ID_PREFIX.task);

	apply({
		kind: "task.create",
		taskId,
		addedAt: new Date().toISOString(),
		urgent: false,
		important: false,
		trackerId: null,
		linkedChecklistId: null,
		...input,
	});

	return taskId;
}

/**
 * Add many tasks to one checklist — a pasted list — as one change, so ten
 * thousand lines are drawn once and saved in one request rather than one at a
 * time. One task goes as one, as if typed.
 */
export function createTasks(
	apply: ApplyChange,
	checklistId: string | null,
	inputs: ReadonlyArray<Omit<Parameters<typeof createTask>[1], "checklistId">>,
): void {
	if (inputs.length === 1) {
		createTask(apply, { checklistId, ...inputs[0] });
		return;
	}

	// A millisecond apart, first line newest, so a newest-first list reads in
	// the order it was pasted rather than shuffled by id.
	const now = Date.now();
	const tasks = inputs.map((input, index) => ({
		taskId: createId(ID_PREFIX.task),
		addedAt: new Date(now - index).toISOString(),
		urgent: false,
		important: false,
		trackerId: null,
		linkedChecklistId: null,
		...input,
	}));

	for (let at = 0; at < tasks.length; at += MAX_TASKS_AT_ONCE) {
		apply({
			kind: "task.createMany",
			checklistId,
			tasks: tasks.slice(at, at + MAX_TASKS_AT_ONCE),
		});
	}
}

/**
 * Make a group from a pasted outline: a checklist for each heading, each with
 * its tasks, a tracker for each `&` heading, and the group holding them — one
 * change, so a hundred checklists are drawn at once and saved in one request;
 * see `parseOutline`.
 */
export function importGroup(
	apply: ApplyChange,
	values: {
		name: string;
		color: TagColor;
		checklists: ReadonlyArray<OutlineChecklist>;
		trackers: ReadonlyArray<OutlineTracker>;
	},
	resolveTag: (name: string) => string | null,
): void {
	apply({
		kind: "group.import",
		groupId: createId(ID_PREFIX.group),
		name: values.name,
		color: values.color,
		startDate: todayDateOnly(),
		checklists: outlineChecklists(values.checklists, resolveTag),
		trackers: outlineTrackers(values.trackers),
	});
}

/**
 * Add a pasted outline to a group that exists: a checklist for each heading,
 * each with its tasks, and a tracker for each `&` heading, put after what the
 * group holds — one change, as `importGroup` makes a new group.
 */
export function importIntoGroup(
	apply: ApplyChange,
	groupId: string,
	outline: {
		checklists: ReadonlyArray<OutlineChecklist>;
		trackers: ReadonlyArray<OutlineTracker>;
	},
	resolveTag: (name: string) => string | null,
): void {
	apply({
		kind: "group.importInto",
		groupId,
		startDate: todayDateOnly(),
		checklists: outlineChecklists(outline.checklists, resolveTag),
		trackers: outlineTrackers(outline.trackers),
	});
}

/** An outline's trackers with the ids a change carries. */
function outlineTrackers(trackers: ReadonlyArray<OutlineTracker>) {
	return trackers.map((tracker) => ({
		...tracker,
		trackerId: createId(ID_PREFIX.tracker),
	}));
}

/** An outline's checklists with the ids, stamps and tags a change carries. */
function outlineChecklists(
	checklists: ReadonlyArray<OutlineChecklist>,
	resolveTag: (name: string) => string | null,
) {
	// A millisecond apart, first line newest, as `createTasks` stamps a paste.
	const now = Date.now();

	return checklists.map((list) => ({
		checklistId: createId(ID_PREFIX.checklist),
		title: list.title,
		description: list.description,
		urgent: list.urgent,
		important: list.important,
		...(list.stages === undefined ? {} : { stages: list.stages }),
		...(list.deadline === undefined ? {} : { deadline: list.deadline }),
		...(list.deadlineTime === undefined
			? {}
			: { deadlineTime: list.deadlineTime }),
		tasks: list.tasks.map((line, index) => ({
			taskId: createId(ID_PREFIX.task),
			title: line.title,
			addedAt: new Date(now - index).toISOString(),
			tagIds: resolveTags(resolveTag, line.tagNames),
			urgent: line.urgent,
			important: line.important,
		})),
	}));
}

/**
 * Make many changes as one: every edit and move `make` applies — through the
 * builders here, a task at a time — is gathered into a single `task.batch`,
 * drawn at once, undone at once, and saved in one request rather than one a
 * task. Anything else it applies goes as it is. More than a request may carry
 * — a tag cleared off every task in a big space — goes in parts.
 */
export function applyBatched(
	apply: ApplyChange,
	make: (collect: ApplyChange) => void,
): void {
	const changes: Array<BatchedChange> = [];
	make((change) => {
		if (isBatchable(change)) changes.push(change);
		else apply(change);
	});

	if (changes.length === 1) {
		apply(changes[0]);
		return;
	}
	for (let at = 0; at < changes.length; at += MAX_TASKS_AT_ONCE) {
		apply({
			kind: "task.batch",
			changes: changes.slice(at, at + MAX_TASKS_AT_ONCE),
		});
	}
}

export function updateTask(
	apply: ApplyChange,
	taskId: string,
	patch: TaskPatch,
): void {
	apply({ kind: "task.update", taskId, patch });
}

/**
 * Put one person on a task, or take them off it — Space on a row, for the
 * person pressing it. Anyone else already on it stays.
 */
export function toggleAssignee(
	apply: ApplyChange,
	task: Pick<Task, "taskId" | "assignees">,
	email: string,
): void {
	const current = task.assignees ?? [];
	updateTask(apply, task.taskId, {
		assignees: current.includes(email)
			? current.filter((each) => each !== email)
			: [...current, email],
	});
}

/**
 * Assign the person pressing it to every task, or — where every one is
 * theirs already — take them off every one; Space over a pick.
 */
export function toggleAssigneeOnAll(
	apply: ApplyChange,
	tasks: ReadonlyArray<Pick<Task, "taskId" | "assignees">>,
	email: string,
): void {
	const isOnAll = tasks.every((task) => (task.assignees ?? []).includes(email));
	applyBatched(apply, (collect) => {
		for (const task of tasks) {
			if ((task.assignees ?? []).includes(email) === isOnAll) {
				toggleAssignee(collect, task, email);
			}
		}
	});
}

/**
 * People given to every task picked out, as `AssignDialog` picks them — the
 * way a tag goes on several: whoever is picked goes on all of them, whoever
 * all of them had and is no longer picked comes off all of them, and anyone
 * on only some is left where they are. For one task, that is the people
 * picked.
 */
export function assignAlike(
	apply: ApplyChange,
	tasks: ReadonlyArray<Pick<Task, "taskId" | "assignees">>,
	chosen: ReadonlyArray<string>,
): void {
	const shared = sharedAssignees(tasks);
	const added = chosen.filter((email) => !shared.includes(email));
	const removed = shared.filter((email) => !chosen.includes(email));

	applyBatched(apply, (collect) => {
		for (const task of tasks) {
			const own = task.assignees ?? [];
			const next = [
				...own.filter((email) => !removed.includes(email)),
				...added.filter((email) => !own.includes(email)),
			];
			const isSame =
				next.length === own.length &&
				next.every((email) => own.includes(email));
			if (!isSame) updateTask(collect, task.taskId, { assignees: next });
		}
	});
}

/**
 * Urgent or important on for every task, or — where every one has it — off
 * for every one; U and I over a pick.
 */
export function toggleFlagOnAll(
	apply: ApplyChange,
	tasks: ReadonlyArray<Pick<Task, "taskId" | "urgent" | "important">>,
	flag: "urgent" | "important",
): void {
	const isOnAll = tasks.every((task) => task[flag]);
	applyBatched(apply, (collect) => {
		for (const task of tasks) {
			if (task[flag] === isOnAll) {
				updateTask(collect, task.taskId, { [flag]: !isOnAll });
			}
		}
	});
}

/**
 * One edit to every task picked out — the bulk edit's; see `TasksEditDialog`.
 * Each task is sent only what the edit changes on it, and one it changes
 * nothing on is left out.
 */
export function updateAllAlike(
	apply: ApplyChange,
	tasks: ReadonlyArray<
		Pick<
			Task,
			| "taskId"
			| "typeId"
			| "caption"
			| "deadline"
			| "deadlineTime"
			| "urgent"
			| "important"
		>
	>,
	edit: Pick<
		TaskPatch,
		"typeId" | "caption" | "deadline" | "deadlineTime" | "urgent" | "important"
	>,
): void {
	applyBatched(apply, (collect) => {
		for (const task of tasks) {
			const own: TaskPatch = {};
			if (edit.typeId !== undefined && edit.typeId !== (task.typeId ?? null)) {
				own.typeId = edit.typeId;
			}
			if (edit.caption !== undefined && edit.caption !== (task.caption ?? "")) {
				own.caption = edit.caption;
			}
			if (
				edit.deadline !== undefined &&
				edit.deadline !== (task.deadline ?? null)
			) {
				own.deadline = edit.deadline;
				// A deadline taken off takes its time with it.
				if (edit.deadline === null && task.deadlineTime) {
					own.deadlineTime = null;
				}
			}
			// A time only goes on a task with a day for it to be on.
			if (
				edit.deadlineTime !== undefined &&
				(edit.deadline === undefined
					? (task.deadline ?? null)
					: edit.deadline) !== null &&
				edit.deadlineTime !== (task.deadlineTime ?? null)
			) {
				own.deadlineTime = edit.deadlineTime;
			}
			if (edit.urgent !== undefined && edit.urgent !== task.urgent) {
				own.urgent = edit.urgent;
			}
			if (edit.important !== undefined && edit.important !== task.important) {
				own.important = edit.important;
			}
			if (Object.keys(own).length > 0) updateTask(collect, task.taskId, own);
		}
	});
}

/**
 * Every task to one stage of its checklist's — "Move to" over a pick — but
 * those already there, and those finished by a tracker or a checklist, which
 * cannot be made done by hand.
 */
export function moveAllToStage(
	apply: ApplyChange,
	entries: ReadonlyArray<{
		task: Pick<
			Task,
			"taskId" | "stageId" | "completed" | "trackerId" | "linkedChecklistId"
		>;
		stages: ReadonlyArray<Stage>;
	}>,
	stageId: string,
): void {
	applyBatched(apply, (collect) => {
		for (const { task, stages } of entries) {
			const isTracked =
				task.trackerId != null || task.linkedChecklistId != null;
			const isDone = stageId === stages[stages.length - 1].stageId;
			if (stageOf(task, stages) === stageId) continue;
			if (isTracked && isDone) continue;
			updateTask(collect, task.taskId, { stageId });
		}
	});
}

/** Give every task one type, or none; K over a pick. */
export function setTypeOnAll(
	apply: ApplyChange,
	tasks: ReadonlyArray<Pick<Task, "taskId" | "typeId">>,
	typeId: string | null,
): void {
	applyBatched(apply, (collect) => {
		for (const task of tasks) {
			if ((task.typeId ?? null) !== typeId) {
				updateTask(collect, task.taskId, { typeId });
			}
		}
	});
}

/**
 * Put a tag on a task, or take it off.
 *
 * The tag is written into the title the way the user would have typed it — at
 * the end — and taken off by removing it wherever it was written, the middle
 * of the sentence included. The title and the list of ids are one answer kept
 * in two places, so both move together or a tag would show on the row and not
 * in the words, or the other way about.
 */
export function setTag(
	apply: ApplyChange,
	task: Pick<Task, "taskId" | "title" | "tagIds">,
	tag: Pick<Tag, "tagId" | "name">,
	isOn: boolean,
): void {
	if (!isOn) {
		updateTask(apply, task.taskId, {
			title: withoutInlineTag(task.title, tag.name),
			tagIds: task.tagIds.filter((tagId) => tagId !== tag.tagId),
		});
		return;
	}

	updateTask(apply, task.taskId, {
		title: withInlineTag(task.title, tag.name),
		tagIds: [...new Set([...task.tagIds, tag.tagId])],
	});
}

/**
 * The same for one of the special tags, named by its kind rather than by id
 * because its name is the user's to change; see `SPECIAL_TAGS`.
 *
 * Nothing happens until the tags have loaded, since until then there is no
 * telling what the tag is called.
 */
export function setSpecialTag(
	apply: ApplyChange,
	task: Pick<Task, "taskId" | "title" | "tagIds">,
	kind: SpecialTag,
	isOn: boolean,
	tags: ReadonlyArray<Tag>,
): void {
	const tag = specialTag(tags, kind);
	if (tag !== null) setTag(apply, task, tag, isOn);
}

/**
 * One of the special tags on every task, or — where every one has it — off
 * every one; T over a pick puts them all on Today.
 */
export function toggleSpecialTagOnAll(
	apply: ApplyChange,
	tasks: ReadonlyArray<Pick<Task, "taskId" | "title" | "tagIds">>,
	kind: SpecialTag,
	tags: ReadonlyArray<Tag>,
): void {
	const tag = specialTag(tags, kind);
	if (tag === null) return;

	const isOnAll = tasks.every((task) => task.tagIds.includes(tag.tagId));
	applyBatched(apply, (collect) => {
		for (const task of tasks) {
			if (task.tagIds.includes(tag.tagId) === isOnAll) {
				setTag(collect, task, tag, !isOnAll);
			}
		}
	});
}

/** What parking a task is: Today taken off it, then the move; see below. */
function parkingChanges(
	task: Pick<Task, "taskId" | "title" | "tagIds">,
	backlogId: string,
	tags: ReadonlyArray<Tag>,
): Array<BatchedChange> {
	const today = specialTag(tags, "today");
	const isOnToday = today !== null && task.tagIds.includes(today.tagId);

	return [
		...(isOnToday && today !== null
			? [
					{
						kind: "task.update" as const,
						taskId: task.taskId,
						patch: {
							title: withoutInlineTag(task.title, today.name),
							tagIds: task.tagIds.filter((tagId) => tagId !== today.tagId),
						},
					},
				]
			: []),
		{ kind: "task.move", taskId: task.taskId, checklistId: backlogId },
	];
}

/**
 * Park a task in the Backlog: off Today, since a task is planned or parked
 * but never both, and then into the Backlog checklist.
 *
 * The checklist it leaves is written into its notes by the move itself; see
 * `notesAfterMove`.
 *
 * Both are drawn at once. Only the sending waits: the move takes off the tags
 * the task only had from the checklist it leaves, which an update landing
 * after it would put back, so the move goes once the edit has landed; see
 * `sendingTasks`.
 */
export async function moveToBacklog(
	applyAsync: ApplyChangeAsync,
	task: Pick<Task, "taskId" | "title" | "tagIds">,
	backlogId: string,
	tags: ReadonlyArray<Tag>,
): Promise<void> {
	try {
		await Promise.all(
			parkingChanges(task, backlogId, tags).map((change) => applyAsync(change)),
		);
	} catch {
		// Already reported by `useApplyChange`.
	}
}

/**
 * Park every task picked out in the Backlog, as one change; see
 * `moveToBacklog`. Each one's edit goes before its move, there as here.
 */
export function moveManyToBacklog(
	apply: ApplyChange,
	tasks: ReadonlyArray<Pick<Task, "taskId" | "title" | "tagIds">>,
	backlogId: string,
	tags: ReadonlyArray<Tag>,
): void {
	applyBatched(apply, (collect) => {
		for (const task of tasks) {
			for (const change of parkingChanges(task, backlogId, tags)) {
				collect(change);
			}
		}
	});
}

/** Resolves once the server has written it; see `createChecklist`. */
export async function createTracker(
	applyAsync: ApplyChangeAsync,
	values: Omit<TrackerValues, never>,
): Promise<string> {
	const trackerId = createId(ID_PREFIX.tracker);
	await applyAsync({ kind: "tracker.create", trackerId, ...values });
	return trackerId;
}

export type TrackerValues = {
	title: string;
	/** A line under the title; see `Tracker.caption`. */
	caption: string;
	type: Tracker["type"];
	unit: string;
	targetValue: number;
	/** Where the count already stood on day one; see `Tracker.startValue`. */
	startValue: number;
	startDate: string;
	deadline: string | null;
	deadlineTime: string | null;
	description: string;
	coverUrl: string | null;
	author: string;
	/** Under each, the tracker counts towards that tag's progress. */
	tagIds: Array<string>;
	/** In a team, who it is for; see `Tracker.assignees`. */
	assignees: Array<string>;
	/**
	 * In a team, who may do what with it, or `null` for everyone at whatever
	 * their role allows; see `accessSchema`.
	 */
	access: Array<AccessEntry> | null;
	/** Editing only: its pictures, when they changed; see `useImageDraft`. */
	images?: Array<ImageRef>;
};

export type EntryValues = { value: number; recordedAt: string; note: string };

export function createEntry(
	apply: ApplyChange,
	trackerId: string,
	values: EntryValues,
): string {
	const entryId = createId(ID_PREFIX.entry);
	apply({ kind: "entry.create", trackerId, entryId, ...values });
	return entryId;
}

export type TagValues = {
	name: string;
	color: TagColor;
	description: string;
	startDate: string | null;
	deadline: string | null;
	deadlineTime: string | null;
	dailyWindow: DailyWindow | null;
	/**
	 * In a team, who may do what with it, or `null` for everyone at whatever
	 * their role allows; see `accessSchema`.
	 */
	access: Array<AccessEntry> | null;
	/** Editing only: each stage's colour on its bar; see `Tag.stageColors`. */
	stageColors?: Record<string, TagColor>;
	/** Editing only: its pictures, when they changed; see `useImageDraft`. */
	images?: Array<ImageRef>;
};

function createTag(apply: ApplyChange, values: TagValues): string {
	const tagId = createId(ID_PREFIX.tag);
	apply({ kind: "tag.create", tagId, ...values });
	return tagId;
}

/** The colour a tag written inline gets; recolour it on the Tags screen. */
function randomTagColor(): TagColor {
	return PICKABLE_COLORS[Math.floor(Math.random() * PICKABLE_COLORS.length)];
}

/**
 * Turn the names written as `#tags` into tag ids, creating the ones that do not
 * exist yet.
 *
 * The Tags screen is the master list, but a tag typed into a task still has to
 * become one or the task would silently lose it. A resolver rather than one
 * call per name, so a name used on three pasted lines is created once.
 *
 * Someone whose role cannot make tags — a collaborator, in a team — gets
 * `null` for a name that is not a tag yet: it stays in the title as they wrote
 * it, as plain words, rather than the whole task being refused.
 */
export function createTagResolver(
	apply: ApplyChange,
	existing: ReadonlyArray<Tag>,
	canCreate = true,
): (name: string) => string | null {
	const minted = new Map<string, string>();

	return (name) => {
		const key = name.toLowerCase();

		const known = existing.find((tag) => sameTagName(tag.name, name));
		if (known) return known.tagId;

		const already = minted.get(key);
		if (already) return already;
		if (!canCreate) return null;

		const tagId = createTag(apply, {
			name,
			color: randomTagColor(),
			description: "",
			startDate: null,
			deadline: null,
			deadlineTime: null,
			dailyWindow: null,
			// A tag typed into a title is shared by nature: whoever reads the
			// task reads the tag. Narrow it from the Tags screen.
			access: null,
		});
		minted.set(key, tagId);
		return tagId;
	};
}

/** Every name a resolver has an id for; see `createTagResolver`. */
export function resolveTags(
	resolve: (name: string) => string | null,
	names: ReadonlyArray<string>,
): Array<string> {
	return names.flatMap((name) => resolve(name) ?? []);
}

/**
 * Turn the tracker name written on a line into the tracker it names.
 *
 * Nothing is created here, unlike the tag resolver: a tracker needs a target, a
 * unit and a deadline, none of which fit on the line. A name matching nothing
 * comes back `null` and the line stays an ordinary task, which is the same
 * outcome as never having typed the `&`.
 */
export function resolveTrackerName(
	trackers: ReadonlyArray<TrackerSummary>,
	name: string | null,
): TrackerSummary | null {
	if (name === null) return null;

	return (
		trackers.find((tracker) => sameTrackerName(tracker.title, name)) ?? null
	);
}

/**
 * The checklist a `&` line names, for a task that stands for it.
 *
 * Asked only once no tracker answers to the name: `&` names either, and when a
 * tracker and a checklist share a title, the tracker wins.
 */
export function resolveChecklistName<
	T extends { checklistId: string; title: string },
>(checklists: ReadonlyArray<T>, name: string | null): T | null {
	if (name === null) return null;

	return (
		checklists.find((checklist) => sameTrackerName(checklist.title, name)) ??
		null
	);
}
