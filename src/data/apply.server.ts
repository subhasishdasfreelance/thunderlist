/**
 * Applying a reviewed batch of queued changes. Server only.
 *
 * This is a replay rather than an all-or-nothing write. Order matters, but not
 * everywhere: a task lands in a checklist the change before it created, while
 * twenty tasks pasted into that checklist have nothing to serialise at all.
 * `planRuns` works out which is which, and each run goes out concurrently.
 *
 * It stops at the first failure and reports how far it got as a prefix, which
 * is what lets the browser drop exactly the changes that landed and keep the
 * rest queued. Every operation it calls is idempotent — creating something that
 * already exists returns it, deleting something already gone is a no-op — so a
 * change replayed after a partial failure cannot double up.
 */

import { AppError } from "#/lib/errors";
import { planRuns } from "#/lib/pending/plan";
import type { ApplyResult, PendingChange } from "#/schemas/pending";
import {
	createChecklist,
	createTask,
	deleteChecklist,
	deleteTask,
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

async function applyOne(change: PendingChange): Promise<void> {
	switch (change.kind) {
		case "checklist.create":
			await createChecklist(change);
			return;

		case "checklist.update":
			await updateChecklist(change.checklistId, change.patch);
			return;

		case "checklist.delete":
			// Clear the references first: if this fails nothing has been destroyed
			// yet, and the checklist is still there to try again.
			await removeTaskRefsFor(change.checklistId);
			await deleteChecklist(change.checklistId);
			return;

		case "task.create":
			await createTask(change);
			return;

		case "task.update":
			await updateTask(change.checklistId, change.taskId, change.patch);
			return;

		case "task.delete":
			await deleteTask(change.checklistId, change.taskId);
			await removeTaskRefsFor(change.checklistId, [change.taskId]);
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
			await deleteTag(change.tagId);
			return;
	}
}

/** Log the real cause, hand back something a person can act on. */
function describe(change: PendingChange, error: unknown): string {
	if (error instanceof AppError) {
		console.error(
			`[thunderlist] applyChanges stopped at ${change.kind}: ${error.code} - ${error.message}`,
		);
		return error.message;
	}

	console.error(`[thunderlist] applyChanges stopped at ${change.kind}:`, error);
	return "Something went wrong while saving. The changes before this one were saved.";
}

export async function applyChanges(
	changes: ReadonlyArray<PendingChange>,
): Promise<ApplyResult> {
	let applied = 0;

	for (const run of planRuns(changes)) {
		const results = await Promise.allSettled(run.map(applyOne));
		const failedAt = results.findIndex(
			(result) => result.status === "rejected",
		);

		if (failedAt !== -1) {
			// Changes after the failure in this run may well have gone through, but
			// the count has to stay a prefix for the browser to trim its queue by.
			// They are replayed on the next attempt, which is safe because every
			// operation here is idempotent.
			const rejection = results[failedAt] as PromiseRejectedResult;
			const index = applied + failedAt;

			return {
				appliedCount: index,
				failure: { index, message: describe(run[failedAt], rejection.reason) },
			};
		}

		applied += run.length;
	}

	return { appliedCount: changes.length, failure: null };
}
