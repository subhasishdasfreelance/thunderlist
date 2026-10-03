/**
 * Taking back the last thing done — Ctrl+Z.
 *
 * A change carries only what to do, never what was there before, so an undo
 * has to be worked out at the moment the change is made, from the copy of the
 * task the browser is drawing. That is what `invertChange` is: given a change
 * and the caches as they are *before* it lands, the change that puts things
 * back — or `null`, for something there is no honest way to reverse.
 *
 * Only what is done while reading a list can be taken back: ticking, flagging,
 * tagging, editing, moving, adding and deleting a task. A checklist or a tag is
 * made and changed in a dialog, where the decision is already deliberate, and
 * undoing a deleted checklist would mean putting back every task in it — which
 * this cannot promise and so does not offer.
 */

import type { QueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { dependentsOf, findCachedTask, stagesOf } from "#/lib/optimistic";
import { shortTitle } from "#/lib/tasks/tasks";
import { queryKeys } from "#/queries/keys";
import { type Change, isBatchable } from "#/schemas/change";
import { type Stage, stageOf } from "#/schemas/checklist";
import type { Tag, TagSummary } from "#/schemas/tag";
import type { Task, TaskPatch } from "#/schemas/task";

/** One step back: what it puts right, and the changes that do it. */
export type UndoStep = {
	/** Names the change in the toast and in the question, in the past tense. */
	label: string;
	/** Applied in order; more than one where putting a task back takes two. */
	changes: Array<Change>;
	/**
	 * Asked before anything is applied, or `null` to simply do it.
	 *
	 * Undoing a tick costs nothing to get wrong — press it again. Undoing an
	 * add deletes a task, and undoing a delete writes one back, so those are
	 * asked about, as every other destructive action in the app is.
	 */
	question: string | null;
};

/**
 * The inverse of an edit: the same fields, as they are now.
 *
 * `stageId` and `completed` are one answer on the server — reaching the last
 * stage is being done — so an edit touching either is put back by the stage
 * the task was at, which says both. Named outright, worked out as its list
 * does (`stageOf`): "not done" alone would land it one stage short of done,
 * not where it was. When it was finished and where it sat go back with it,
 * rather than being stamped afresh. Returns `null` when there is nothing to
 * put back, so a no-op is never queued as an undo.
 */
function previousPatch(
	task: Task,
	patch: TaskPatch,
	stages: ReadonlyArray<Stage>,
): TaskPatch | null {
	const previous: TaskPatch = {};

	if ("title" in patch) previous.title = task.title;
	if ("tagIds" in patch) previous.tagIds = [...task.tagIds];
	if ("urgent" in patch) previous.urgent = task.urgent;
	if ("important" in patch) previous.important = task.important;
	if ("caption" in patch) previous.caption = task.caption ?? "";
	if ("notes" in patch) previous.notes = task.notes ?? "";
	if ("assignees" in patch) previous.assignees = [...(task.assignees ?? [])];
	if ("typeId" in patch) previous.typeId = task.typeId ?? null;
	if ("dependsOn" in patch) previous.dependsOn = [...(task.dependsOn ?? [])];
	if ("subtasks" in patch) previous.subtasks = [...(task.subtasks ?? [])];
	if ("deadline" in patch) previous.deadline = task.deadline ?? null;
	if ("deadlineTime" in patch)
		previous.deadlineTime = task.deadlineTime ?? null;

	if ("stageId" in patch || "completed" in patch) {
		previous.stageId = stageOf(task, stages);
		previous.completedAt = task.completedAt ?? null;
		previous.addedAt = task.addedAt;
	}

	return Object.keys(previous).length === 0 ? null : previous;
}

/** The fields `task.create` does not carry, where the task had any of them. */
function restOfTask(
	task: Task,
	stages: ReadonlyArray<Stage>,
): TaskPatch | null {
	const rest: TaskPatch = {};

	if (task.caption) rest.caption = task.caption;
	if (task.notes) rest.notes = task.notes;
	if (task.assignees?.length) rest.assignees = [...task.assignees];
	if (task.typeId) rest.typeId = task.typeId;
	if (task.dependsOn?.length) rest.dependsOn = [...task.dependsOn];
	if (task.subtasks?.length) rest.subtasks = [...task.subtasks];
	if (task.deadline) rest.deadline = task.deadline;
	if (task.deadlineTime) rest.deadlineTime = task.deadlineTime;
	// A task comes back at the stage it was taken from, which says whether it
	// was done as well — finished when it was; see `previousPatch`.
	const at = stageOf(task, stages);
	if (at !== stages[0].stageId) {
		rest.stageId = at;
		rest.completedAt = task.completedAt ?? null;
		rest.addedAt = task.addedAt;
	}

	return Object.keys(rest).length === 0 ? null : rest;
}

/** A deleted task as adding it again writes it; see `putBack`. */
function asAdded(task: Task) {
	return {
		// Its own id, so it comes back as the task it was rather than as a
		// copy of it; see `changeSchema`.
		taskId: task.taskId,
		title: task.title,
		addedAt: task.addedAt,
		tagIds: [...task.tagIds],
		trackerId: task.trackerId ?? null,
		linkedChecklistId: task.linkedChecklistId ?? null,
		urgent: task.urgent,
		important: task.important,
		...(task.number === undefined ? {} : { number: task.number }),
	};
}

/**
 * Many deleted tasks written back, as `putBack` writes one, in as few changes
 * as there can be: the tasks in one go for each checklist they were in, then
 * the rest of what they carried and what waited on them, which the undo
 * sends as one batch; see `UndoProvider`.
 */
function putBackMany(
	client: QueryClient,
	found: ReadonlyArray<{ task: Task; checklistId: string | null }>,
): Array<Change> {
	const byChecklist = new Map<string | null, Array<Task>>();
	for (const { task, checklistId } of found) {
		byChecklist.set(checklistId, [
			...(byChecklist.get(checklistId) ?? []),
			task,
		]);
	}

	const rest = found.flatMap(({ task, checklistId }) => {
		const patch = restOfTask(task, stagesOf(client, checklistId));
		return patch === null
			? []
			: [{ kind: "task.update" as const, taskId: task.taskId, patch }];
	});

	// Each waiting task once, however many of these it waited on.
	const deleted = new Set(found.map(({ task }) => task.taskId));
	const waiting = new Map<string, Task>();
	for (const { task } of found) {
		for (const each of dependentsOf(client, task.taskId)) {
			if (!deleted.has(each.taskId)) waiting.set(each.taskId, each);
		}
	}

	return [
		...[...byChecklist].map(([checklistId, tasks]) => ({
			kind: "task.createMany" as const,
			checklistId,
			tasks: tasks.map(asAdded),
		})),
		...rest,
		...[...waiting.values()].map((each) => ({
			kind: "task.update" as const,
			taskId: each.taskId,
			patch: { dependsOn: [...(each.dependsOn ?? [])] },
		})),
	];
}

/**
 * The changes that write a deleted task back as it was: under its own number,
 * and waited on again by whatever waited on it, since deleting it took their
 * wait off; see `clearDependencies`.
 */
function putBack(
	client: QueryClient,
	task: Task,
	checklistId: string | null,
): Array<Change> {
	const rest = restOfTask(task, stagesOf(client, checklistId));

	return [
		{ kind: "task.create", checklistId, ...asAdded(task) },
		// Adding a task is one line of typing, so the rest of what it carried
		// is a second change; see `restOfTask`.
		...(rest === null
			? []
			: [{ kind: "task.update" as const, taskId: task.taskId, patch: rest }]),
		...dependentsOf(client, task.taskId).map((waiting) => ({
			kind: "task.update" as const,
			taskId: waiting.taskId,
			patch: { dependsOn: [...(waiting.dependsOn ?? [])] },
		})),
	];
}

/**
 * The tags these tasks are losing, made again ahead of putting them back: a
 * tag whose last task it came off was deleted with it; see
 * `deleteUnusedTags`. Making one that is still there changes nothing, so a tag
 * the Tags screen shows on other tasks too is left out, and Today, which is
 * never deleted, always is.
 */
function tagsBack(
	client: QueryClient,
	tasks: ReadonlyArray<Pick<Task, "tagIds">>,
): Array<Change> {
	const summaries = client.getQueryData<Array<TagSummary>>(
		queryKeys.tagSummaries,
	);
	const tags = client.getQueryData<Array<Tag>>(queryKeys.tags) ?? [];

	return tags.flatMap((tag) => {
		if (tag.special != null) return [];
		const losing = tasks.filter((task) => task.tagIds.includes(tag.tagId));
		if (losing.length === 0) return [];
		const total = summaries?.find((each) => each.tagId === tag.tagId)?.progress
			.total;
		if (total !== undefined && total > losing.length) return [];

		return [
			{
				kind: "tag.create" as const,
				tagId: tag.tagId,
				name: tag.name,
				color: tag.color,
				description: tag.description ?? "",
				startDate: tag.startDate ?? null,
				deadline: tag.deadline ?? null,
				deadlineTime: tag.deadlineTime ?? null,
				dailyWindow: tag.dailyWindow ?? null,
				access: tag.access ?? null,
			},
		];
	});
}

/**
 * The tags an edit or a move takes off a task: the ones an edit leaves out,
 * and for a move all of them, since moving takes off those it had from the
 * checklist it left.
 */
function tagsTakenOff(
	client: QueryClient,
	change: Extract<Change, { kind: "task.update" | "task.move" }>,
): Pick<Task, "tagIds"> {
	const found = findCachedTask(client, change.taskId);
	if (found === null) return { tagIds: [] };
	if (change.kind === "task.move") return found.task;

	const { tagIds } = change.patch;
	return {
		tagIds:
			tagIds === undefined
				? []
				: found.task.tagIds.filter((tagId) => !tagIds.includes(tagId)),
	};
}

/**
 * What would put `change` back, read off the caches as they are before it is
 * applied. `null` for a change nothing here can reverse.
 */
export function invertChange(
	client: QueryClient,
	change: Change,
): UndoStep | null {
	switch (change.kind) {
		case "task.update": {
			const found = findCachedTask(client, change.taskId);
			if (found === null) return null;

			const patch = previousPatch(
				found.task,
				change.patch,
				stagesOf(client, found.checklistId),
			);
			if (patch === null) return null;

			return {
				label: `Edit to "${shortTitle(found.task.title)}"`,
				changes: [
					...tagsBack(client, [tagsTakenOff(client, change)]),
					{ kind: "task.update", taskId: change.taskId, patch },
				],
				question: null,
			};
		}

		case "task.move": {
			const found = findCachedTask(client, change.taskId);
			// Nowhere to send it back to: a task that was in no checklist is in
			// the Inbox by the time it can be moved out of one.
			if (found === null || found.checklistId === null) return null;
			if (found.checklistId === change.checklistId) return null;

			/*
			 * Moved back, then put back as it was there: moving starts a task at
			 * the top of its new list's first stage and writes a line into its
			 * notes, and moving it back would do both again.
			 */
			const { task } = found;
			return {
				label: `Moving "${shortTitle(task.title)}"`,
				changes: [
					...tagsBack(client, [tagsTakenOff(client, change)]),
					{
						kind: "task.move",
						taskId: change.taskId,
						checklistId: found.checklistId,
					},
					{
						kind: "task.update",
						taskId: change.taskId,
						patch: {
							stageId: stageOf(task, stagesOf(client, found.checklistId)),
							completedAt: task.completedAt ?? null,
							addedAt: task.addedAt,
							notes: task.notes ?? "",
							tagIds: [...task.tagIds],
						},
					},
				],
				question: null,
			};
		}

		case "task.create": {
			const title = shortTitle(change.title);

			return {
				label: `Adding "${title}"`,
				changes: [{ kind: "task.delete", taskId: change.taskId }],
				question: `Undo adding "${title}"? The task will be deleted.`,
			};
		}

		case "task.createMany": {
			const count = `${change.tasks.length} tasks`;

			return {
				label: `Adding ${count}`,
				changes: [
					{
						kind: "task.deleteMany",
						taskIds: change.tasks.map((task) => task.taskId),
					},
				],
				question: `Undo adding ${count}? They will be deleted.`,
			};
		}

		case "task.delete": {
			const found = findCachedTask(client, change.taskId);
			if (found === null) return null;

			const title = shortTitle(found.task.title);

			return {
				label: `Deleting "${title}"`,
				changes: [
					...tagsBack(client, [found.task]),
					...putBack(client, found.task, found.checklistId),
				],
				question: `Undo deleting "${title}"? The task will be put back.`,
			};
		}

		// Only the tasks this browser has seen can be put back; a list's
		// other pages were never read, so there is nothing to write back.
		case "task.deleteMany": {
			const found = change.taskIds
				.map((taskId) => findCachedTask(client, taskId))
				.filter((each) => each !== null);
			if (found.length === 0) return null;

			const count = `${found.length} ${found.length === 1 ? "task" : "tasks"}`;

			return {
				label: `Deleting ${count}`,
				changes: [
					...tagsBack(
						client,
						found.map(({ task }) => task),
					),
					...putBackMany(client, found),
				],
				question: `Undo deleting ${count}? They will be put back.`,
			};
		}

		/*
		 * Made at once, so undone at once: every one put back, last first, in
		 * one batch of its own.
		 */
		case "task.batch": {
			const steps = change.changes
				.map((each) => invertChange(client, each))
				.filter((step) => step !== null);
			if (steps.length === 0) return null;

			const count = new Set(change.changes.map((each) => each.taskId)).size;

			return {
				label: count === 1 ? steps[0].label : `Changes to ${count} tasks`,
				changes: [
					// Asked of them all together: a tag the batch took off its last
					// three tasks is on others still for each one alone.
					...tagsBack(
						client,
						change.changes.map((each) => tagsTakenOff(client, each)),
					),
					{
						kind: "task.batch",
						changes: steps
							.reverse()
							.flatMap((step) => step.changes)
							.filter(isBatchable),
					},
				],
				question: null,
			};
		}

		default:
			// Everything else is done in a dialog, where nothing happens by
			// accident and Ctrl+Z is not what anyone reaches for.
			return null;
	}
}

/** What the provider offers: see `UndoProvider` and `UndoQuestion`. */
export type Undo = {
	/** Where a change hands in its undo on its way out; see `useApplyChange`. */
	remember: (change: Change) => void;
	/**
	 * Take back the undo a change handed in, once the server has refused it:
	 * there is nothing to undo of a change that never happened.
	 */
	forget: (change: Change) => void;
	/** What the next undo takes back, or `null` with nothing to undo. */
	latest: string | null;
	/** Take the last step back — Ctrl+Z, or the Undo in the top bar. */
	undoLast: () => void;
	/** The step waiting on an answer, or `null` while none is; see `question`. */
	asking: UndoStep | null;
	/** Do the step being asked about. */
	confirm: () => void;
	/** Leave it undone. */
	dismiss: () => void;
};

/**
 * `null` outside the provider, where nothing is remembered — which is how the
 * undo itself is applied without being recorded as one more thing to undo.
 */
export const UndoContext = createContext<Undo | null>(null);

export function useUndo(): Undo | null {
	return useContext(UndoContext);
}

export function useRememberUndo(): Pick<Undo, "remember" | "forget"> | null {
	return useContext(UndoContext);
}
