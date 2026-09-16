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
import { findCachedTask } from "#/lib/optimistic";
import { shortTitle } from "#/lib/tasks/tasks";
import type { Change } from "#/schemas/change";
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
 * the task was at, which says both. Returns `null` when there is nothing to
 * put back, so a no-op is never queued as an undo.
 */
function previousPatch(task: Task, patch: TaskPatch): TaskPatch | null {
	const previous: TaskPatch = {};

	if ("title" in patch) previous.title = task.title;
	if ("tagIds" in patch) previous.tagIds = [...task.tagIds];
	if ("urgent" in patch) previous.urgent = task.urgent;
	if ("important" in patch) previous.important = task.important;
	if ("caption" in patch) previous.caption = task.caption ?? "";
	if ("notes" in patch) previous.notes = task.notes ?? "";
	if ("assignees" in patch) previous.assignees = [...(task.assignees ?? [])];
	if ("typeId" in patch) previous.typeId = task.typeId ?? null;

	if ("stageId" in patch || "completed" in patch) {
		if (task.stageId) previous.stageId = task.stageId;
		else previous.completed = task.completed;
	}

	return Object.keys(previous).length === 0 ? null : previous;
}

/** The fields `task.create` does not carry, where the task had any of them. */
function restOfTask(task: Task): TaskPatch | null {
	const rest: TaskPatch = {};

	if (task.caption) rest.caption = task.caption;
	if (task.notes) rest.notes = task.notes;
	if (task.assignees?.length) rest.assignees = [...task.assignees];
	if (task.typeId) rest.typeId = task.typeId;
	// A task comes back at the stage it was taken from, which says whether it
	// was done as well; see `previousPatch`.
	if (task.stageId) rest.stageId = task.stageId;

	return Object.keys(rest).length === 0 ? null : rest;
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

			const patch = previousPatch(found.task, change.patch);
			if (patch === null) return null;

			return {
				label: `Edit to "${shortTitle(found.task.title)}"`,
				changes: [{ kind: "task.update", taskId: change.taskId, patch }],
				question: null,
			};
		}

		case "task.move": {
			const found = findCachedTask(client, change.taskId);
			// Nowhere to send it back to: a task that was in no checklist is in
			// the Inbox by the time it can be moved out of one.
			if (found === null || found.checklistId === null) return null;
			if (found.checklistId === change.checklistId) return null;

			return {
				label: `Moving "${shortTitle(found.task.title)}"`,
				changes: [
					{
						kind: "task.move",
						taskId: change.taskId,
						checklistId: found.checklistId,
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

		case "task.delete": {
			const found = findCachedTask(client, change.taskId);
			if (found === null) return null;

			const { task, checklistId } = found;
			const rest = restOfTask(task);
			const title = shortTitle(task.title);

			return {
				label: `Deleting "${title}"`,
				changes: [
					{
						kind: "task.create",
						checklistId,
						// Its own id, so it comes back as the task it was rather than
						// as a copy of it; see `changeSchema`.
						taskId: task.taskId,
						title: task.title,
						addedAt: task.addedAt,
						tagIds: [...task.tagIds],
						trackerId: task.trackerId ?? null,
						linkedChecklistId: task.linkedChecklistId ?? null,
						urgent: task.urgent,
						important: task.important,
					},
					// Adding a task is one line of typing, so the rest of what it
					// carried is a second change; see `restOfTask`.
					...(rest === null
						? []
						: [
								{
									kind: "task.update" as const,
									taskId: task.taskId,
									patch: rest,
								},
							]),
				],
				question: `Undo deleting "${title}"? The task will be put back.`,
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

export function useRememberUndo(): ((change: Change) => void) | null {
	return useContext(UndoContext)?.remember ?? null;
}
