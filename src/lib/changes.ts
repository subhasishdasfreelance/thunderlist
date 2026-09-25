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
import { errorMessage } from "#/lib/errors";
import { createId, ID_PREFIX } from "#/lib/ids";
import { applyOptimistically, restore, snapshot } from "#/lib/optimistic";
import { playChangeSound } from "#/lib/sounds";
import {
	sameTagName,
	sameTrackerName,
	withInlineTag,
	withoutInlineTag,
} from "#/lib/tags/inline-tags";
import { captionFromChecklist } from "#/lib/tasks/tasks";
import { useToast } from "#/lib/toasts";
import { useRememberUndo } from "#/lib/undo";
import { queryKeys } from "#/queries/keys";
import type { AccessEntry } from "#/schemas/access";
import type { Change } from "#/schemas/change";
import type { Stage } from "#/schemas/checklist";
import type { DailyWindow } from "#/schemas/common";
import {
	PICKABLE_COLORS,
	type SpecialTag,
	specialTag,
	type Tag,
	type TagColor,
} from "#/schemas/tag";
import type { Task, TaskPatch } from "#/schemas/task";
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
		case "task.move":
			return change.checklistId;
		default:
			return null;
	}
}

/**
 * The last change sent for each task, still on its way.
 *
 * Several changes to one task can be made at once — parking it is an edit and
 * then a move, undoing a delete is the task and then the rest of it — and each
 * is drawn the moment it is made. Only the sending waits: a change to a task
 * goes once the one before it has landed, since two requests can arrive in
 * either order and the second may name a task the first has yet to write.
 */
const sendingTasks = new Map<string, Promise<unknown>>();

/** The task a change is about, if it is about one. */
function taskOf(change: Change): string | null {
	switch (change.kind) {
		case "task.create":
		case "task.update":
		case "task.delete":
		case "task.move":
			return change.taskId;
		default:
			return null;
	}
}

/** Send one change, after any change to the same task before it. */
function send(change: Change): Promise<void> {
	const taskId = taskOf(change);
	if (taskId === null) return sendNow(change);

	const before = sendingTasks.get(taskId);
	const sending = (async () => {
		// Whatever became of the one before, this one is still asked for.
		await before?.catch(() => {});
		await sendNow(change);
	})();

	sendingTasks.set(taskId, sending);
	void sending
		.catch(() => {})
		.finally(() => {
			if (sendingTasks.get(taskId) === sending) sendingTasks.delete(taskId);
		});
	return sending;
}

/** Send one change, once any checklist it depends on has been written. */
async function sendNow(change: Change): Promise<void> {
	const needed = checklistNeeded(change);
	if (needed !== null) await creatingChecklists.get(needed);

	const request = applyChangeFn({ data: { change } });

	if (change.kind === "checklist.create") {
		const { checklistId } = change;
		// A failed creation reports itself; anything waiting on it then goes
		// ahead and fails on its own terms, which is the honest answer.
		creatingChecklists.set(
			checklistId,
			request.catch(() => {}),
		);

		try {
			await request;
		} finally {
			creatingChecklists.delete(checklistId);
		}
		return;
	}

	await request;
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
	const remember = useRememberUndo();

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
			remember?.(change);
			applyOptimistically(queryClient, change);
			return { previous };
		},

		// The guess was wrong. Put back exactly what was there rather than trying
		// to reverse each patch, which is where this kind of code usually breaks.
		onError: (error, change, context) => {
			if (context?.previous) restore(queryClient, context.previous);

			/*
			 * A checklist or tracker that was only ever drawn has no earlier state
			 * to put back — its own caches did not exist to be snapshotted — so
			 * they are emptied instead: the screen showing it asks again and hears
			 * that it does not exist, rather than showing it as if saved.
			 */
			if (change.kind === "checklist.create") {
				void queryClient.resetQueries({
					queryKey: queryKeys.checklist(change.checklistId),
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
		onSettled: async () => {
			if (queryClient.isMutating() === 1) await queryClient.invalidateQueries();
		},
	});

	// Heard the moment it is made, as it is drawn; the save follows behind.
	const apply = useCallback(
		(change: Change) => {
			playChangeSound(change);
			mutation.mutate(change);
		},
		[mutation.mutate],
	);

	/** For a caller that needs one change to land before it makes the next. */
	const applyAsync = useCallback(
		(change: Change) => {
			playChangeSound(change);
			return mutation.mutateAsync(change);
		},
		[mutation.mutateAsync],
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
};

/**
 * Resolves with the new id once the server has written it, so the caller can
 * go into it knowing it is there; rejects if it was refused.
 */
export async function createChecklist(
	applyAsync: ApplyChangeAsync,
	values: ChecklistValues,
): Promise<string> {
	const checklistId = createId(ID_PREFIX.checklist);
	await applyAsync({ kind: "checklist.create", checklistId, ...values });
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
 * Park a task in the Backlog: off Today, since a task is planned or parked
 * but never both, and then into the Backlog checklist.
 *
 * The checklist it leaves is written into its caption. Parked tasks from every
 * list sit together, and without the note the one thing you need to put a task
 * back — where it came from — is the one thing the move throws away.
 *
 * Both are drawn at once. Only the sending waits: the move takes off the tags
 * the task only had from the checklist it leaves, which an update landing
 * after it would put back, so the move goes once the edit has landed; see
 * `sendingTasks`.
 */
export async function moveToBacklog(
	applyAsync: ApplyChangeAsync,
	task: Pick<Task, "taskId" | "title" | "tagIds" | "caption">,
	backlogId: string,
	tags: ReadonlyArray<Tag>,
	/** The checklist it is leaving, or `null` when it is in none. */
	fromTitle: string | null,
	/** Every checklist's title; see `captionFromChecklist`. */
	checklistTitles: ReadonlyArray<string>,
): Promise<void> {
	const today = specialTag(tags, "today");
	const isOnToday = today !== null && task.tagIds.includes(today.tagId);

	const patch: TaskPatch = {
		...(isOnToday && today !== null
			? {
					title: withoutInlineTag(task.title, today.name),
					tagIds: task.tagIds.filter((tagId) => tagId !== today.tagId),
				}
			: {}),
		...(fromTitle === null || fromTitle === ""
			? {}
			: {
					caption: captionFromChecklist(
						task.caption,
						fromTitle,
						checklistTitles,
					),
				}),
	};

	try {
		await Promise.all([
			...(Object.keys(patch).length > 0
				? [applyAsync({ kind: "task.update", taskId: task.taskId, patch })]
				: []),
			applyAsync({
				kind: "task.move",
				taskId: task.taskId,
				checklistId: backlogId,
			}),
		]);
	} catch {
		// Already reported by `useApplyChange`.
	}
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
};

export function createTag(apply: ApplyChange, values: TagValues): string {
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
