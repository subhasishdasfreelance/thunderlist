/**
 * Applying one change. Server only.
 *
 * Every mutation in the app arrives here as a single command and goes straight
 * to the database. There is no queue and no batch: what the user did is done by
 * the time the screen refetches.
 *
 * Each operation is idempotent — creating something that already exists returns
 * it, deleting something already gone is a no-op — so a retry after a dropped
 * connection cannot double up.
 */

import { AppError } from "#/lib/errors";
import type { Change } from "#/schemas/change";
import {
	createChecklist,
	createTask,
	deleteChecklist,
	deleteTask,
	readChecklistTaskIds,
	removeTagFromTasks,
	updateChecklist,
	updateTask,
} from "./checklist.server";
import { createTag, deleteTag, updateTag } from "./tag.server";
import {
	addTaskRef,
	moveTaskRef,
	removeTaskRef,
	removeTaskRefsFor,
} from "./task-list.server";
import {
	createProgressEntry,
	createTracker,
	deleteProgressEntry,
	deleteTracker,
	updateProgressEntry,
	updateTracker,
} from "./tracker.server";

async function run(change: Change): Promise<void> {
	switch (change.kind) {
		case "checklist.create":
			await createChecklist(change);
			return;

		case "checklist.update":
			await updateChecklist(change.checklistId, change.patch);
			return;

		case "checklist.delete": {
			// Clear the references first: if this fails nothing has been destroyed
			// yet, and the checklist is still there to try again.
			const taskIds = await readChecklistTaskIds(change.checklistId);
			await removeTaskRefsFor(taskIds);
			await deleteChecklist(change.checklistId);
			return;
		}

		case "task.create":
			await createTask(change);
			return;

		case "task.update":
			await updateTask(change.taskId, change.patch);
			return;

		case "task.delete":
			await deleteTask(change.taskId);
			await removeTaskRefsFor([change.taskId]);
			return;

		case "tracker.create":
			await createTracker(change);
			return;

		case "tracker.update":
			await updateTracker(change.trackerId, change.patch);
			return;

		case "tracker.delete":
			await deleteTracker(change.trackerId);
			return;

		case "entry.create":
			await createProgressEntry(change);
			return;

		case "entry.update":
			await updateProgressEntry(change.trackerId, change.entryId, change.patch);
			return;

		case "entry.delete":
			await deleteProgressEntry(change.trackerId, change.entryId);
			return;

		case "ref.add":
			await addTaskRef(change);
			return;

		case "ref.remove":
			await removeTaskRef(change.list, change.itemId);
			return;

		case "ref.move":
			await moveTaskRef(change.list, change.itemId, change.direction);
			return;

		case "tag.create":
			await createTag(change);
			return;

		case "tag.update":
			await updateTag(change.tagId, change.patch);
			return;

		case "tag.delete":
			await removeTagFromTasks(change.tagId);
			await deleteTag(change.tagId);
			return;
	}
}

/** Log the real cause, hand back something a person can act on. */
export async function applyChange(change: Change): Promise<void> {
	try {
		await run(change);
	} catch (error) {
		if (error instanceof AppError) {
			console.error(
				`[thunderlist] ${change.kind}: ${error.code} - ${error.message}`,
			);
			throw error;
		}

		console.error(`[thunderlist] ${change.kind} failed:`, error);
		throw new AppError(
			"upstream_failed",
			"Something went wrong while saving. Please try again.",
		);
	}
}
