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
 *
 * The owner comes in as an argument and every branch passes it on. The ids in
 * a change are the browser's, and therefore anybody's; the owner is the
 * server's, read from the session, and it is what makes a change naming
 * someone else's row a no-op rather than an edit.
 */

import { AppError } from "#/lib/errors";
import type { Change } from "#/schemas/change";
import {
	createChecklist,
	createTask,
	deleteChecklist,
	deleteTask,
	moveTask,
	updateChecklist,
	updateTask,
} from "./checklist.server";
import { createTag, deleteTag, updateTag } from "./tag.server";
import {
	createProgressEntry,
	createTracker,
	deleteProgressEntry,
	deleteTracker,
	updateProgressEntry,
	updateTracker,
} from "./tracker.server";

async function run(userId: string, change: Change): Promise<void> {
	switch (change.kind) {
		case "checklist.create":
			await createChecklist(userId, change);
			return;

		case "checklist.update":
			await updateChecklist(userId, change.checklistId, change.patch);
			return;

		case "checklist.delete":
			await deleteChecklist(userId, change.checklistId);
			return;

		case "task.create":
			await createTask(userId, change);
			return;

		case "task.update":
			await updateTask(userId, change.taskId, change.patch);
			return;

		case "task.delete":
			await deleteTask(userId, change.taskId);
			return;

		case "task.move":
			await moveTask(userId, change.taskId, change.checklistId);
			return;

		case "tracker.create":
			await createTracker(userId, change);
			return;

		case "tracker.update":
			await updateTracker(userId, change.trackerId, change.patch);
			return;

		case "tracker.delete":
			await deleteTracker(userId, change.trackerId);
			return;

		case "entry.create":
			await createProgressEntry(userId, change);
			return;

		case "entry.update":
			await updateProgressEntry(
				userId,
				change.trackerId,
				change.entryId,
				change.patch,
			);
			return;

		case "entry.delete":
			await deleteProgressEntry(userId, change.trackerId, change.entryId);
			return;

		case "tag.create":
			await createTag(userId, change);
			return;

		case "tag.update":
			await updateTag(userId, change.tagId, change.patch);
			return;

		case "tag.delete":
			// It takes the tag off everything carrying it first; see `deleteTag`.
			await deleteTag(userId, change.tagId);
			return;
	}
}

/** Log the real cause, hand back something a person can act on. */
export async function applyChange(
	userId: string,
	change: Change,
): Promise<void> {
	try {
		await run(userId, change);
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
