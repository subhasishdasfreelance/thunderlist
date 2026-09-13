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
 * The owner comes in with the scope and every branch passes it on. The ids in
 * a change are the browser's, and therefore anybody's; the owner is the
 * server's, read from the session, and it is what makes a change naming
 * someone else's row a no-op rather than an edit. In a team the scope also
 * says what this person is in it and what is kept from them, and a change is
 * refused before it can reach anything their role may not change or they may
 * not see; see `assertAllowed`.
 */

import { AppError } from "#/lib/errors";
import { collections } from "#/lib/mongo/client.server";
import type { Change } from "#/schemas/change";
import { type Capability, ROLE_LABELS, roleCan } from "#/schemas/team";
import {
	createChecklist,
	createTask,
	deleteChecklist,
	deleteTask,
	moveTask,
	updateChecklist,
	updateTask,
} from "./checklist.server";
import { setTaskTypes } from "./settings.server";
import { createTag, deleteTag, updateTag } from "./tag.server";
import type { Scope } from "./team.server";
import {
	createProgressEntry,
	createTracker,
	deleteProgressEntry,
	deleteTracker,
	updateProgressEntry,
	updateTracker,
} from "./tracker.server";
import {
	assertChecklistVisible,
	assertTagVisible,
	assertTrackerVisible,
	isTaskVisible,
} from "./visibility.server";

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

		case "taskTypes.set":
			await setTaskTypes(userId, change.types);
			return;
	}
}

/**
 * What a role needs to be allowed a change; see `Capability`.
 *
 * Moving work along — ticking a task, sending it to its next stage, editing
 * it, taking it on, recording a tracker's reading — is updating what exists.
 * Everything else — adding or deleting anything, moving a task to another
 * checklist, and checklists, trackers, tags and task types themselves, who can
 * see them included — is shaping the work, which is a project manager's.
 */
function capabilityFor(change: Change): Capability {
	switch (change.kind) {
		case "task.update":
		case "entry.create":
		case "entry.update":
			return "updateTasks";
		default:
			return "manageContent";
	}
}

/**
 * Refuse a change this person may not make where they are working.
 *
 * In your own space there is nobody else, and everything is allowed. In a team,
 * their role has to allow it; everyone a change names — to assign something
 * to, or to let see something — has to be in the team; and a change cannot
 * reach anything kept from this person, which to them does not exist.
 */
async function assertAllowed(scope: Scope, change: Change): Promise<void> {
	const { team, hidden } = scope;
	if (team === null) return;

	const needed = capabilityFor(change);
	if (!roleCan(team.role, needed)) {
		throw new AppError(
			"invalid_data",
			roleCan(team.role, "updateTasks")
				? `${ROLE_LABELS[team.role]}s can update tasks, but not add, delete or move them, or change checklists, trackers, tags or task types.`
				: `${ROLE_LABELS[team.role]}s can't change anything in this team.`,
		);
	}

	const outsider = namedPeople(change).find(
		(email) => !team.emails.includes(email),
	);
	if (outsider !== undefined) {
		throw new AppError("invalid_data", `${outsider} is not in this team.`);
	}

	switch (change.kind) {
		case "checklist.update":
		case "checklist.delete":
			assertChecklistVisible(hidden, change.checklistId);
			return;

		case "task.create":
			if (change.checklistId !== null) {
				assertChecklistVisible(hidden, change.checklistId);
			}
			if (change.linkedChecklistId != null) {
				assertChecklistVisible(hidden, change.linkedChecklistId);
			}
			if (change.trackerId != null) {
				assertTrackerVisible(hidden, change.trackerId);
			}
			return;

		case "tracker.update":
		case "tracker.delete":
		case "entry.create":
		case "entry.update":
		case "entry.delete":
			assertTrackerVisible(hidden, change.trackerId);
			return;

		case "task.move":
			assertChecklistVisible(hidden, change.checklistId);
			await assertTaskVisible(scope, change.taskId);
			return;

		case "task.update":
		case "task.delete":
			await assertTaskVisible(scope, change.taskId);
			return;

		case "tag.update":
		case "tag.delete":
			assertTagVisible(hidden, change.tagId);
			return;

		default:
			return;
	}
}

/** Everyone a change assigns something to, or lets see something. */
function namedPeople(change: Change): ReadonlyArray<string> {
	switch (change.kind) {
		case "checklist.create":
		case "tag.create":
			return change.visibleTo ?? [];
		case "checklist.update":
		case "tag.update":
			return change.patch.visibleTo ?? [];
		case "task.update":
			return change.patch.assignees ?? [];
		case "tracker.create":
			return [...change.assignees, ...(change.visibleTo ?? [])];
		case "tracker.update":
			return [
				...(change.patch.assignees ?? []),
				...(change.patch.visibleTo ?? []),
			];
		default:
			return [];
	}
}

/** A task is seen by whoever can see where it lives; see `isTaskVisible`. */
async function assertTaskVisible(scope: Scope, taskId: string): Promise<void> {
	const { hidden } = scope;
	if (hidden.checklistIds.size === 0 && hidden.tagIds.size === 0) return;

	const current = await collections();
	const task = await current.tasks.findOne(
		{ taskId, userId: scope.ownerId },
		{ projection: { _id: 0, checklistId: 1, tagIds: 1 } },
	);

	if (task && !isTaskVisible(task, hidden)) {
		throw new AppError("not_found", "That task no longer exists.");
	}
}

/**
 * Whoever keeps a checklist, a tag or a tracker to a few people is one of
 * them, so the list they choose never locks them out of what they are working
 * on.
 */
function includingActor(scope: Scope, change: Change): Change {
	if (scope.team === null) return change;

	const including = (people: Array<string> | null) =>
		people === null || people.includes(scope.email)
			? people
			: [...people, scope.email];

	switch (change.kind) {
		case "checklist.create":
			return { ...change, visibleTo: including(change.visibleTo) };

		case "tag.create":
			return { ...change, visibleTo: including(change.visibleTo) };

		case "tracker.create":
			return { ...change, visibleTo: including(change.visibleTo) };

		case "checklist.update": {
			const { visibleTo } = change.patch;
			return visibleTo === undefined
				? change
				: {
						...change,
						patch: { ...change.patch, visibleTo: including(visibleTo) },
					};
		}

		case "tracker.update": {
			const { visibleTo } = change.patch;
			return visibleTo === undefined
				? change
				: {
						...change,
						patch: { ...change.patch, visibleTo: including(visibleTo) },
					};
		}

		case "tag.update": {
			const { visibleTo } = change.patch;
			return visibleTo === undefined
				? change
				: {
						...change,
						patch: { ...change.patch, visibleTo: including(visibleTo) },
					};
		}

		default:
			return change;
	}
}

/** Log the real cause, hand back something a person can act on. */
export async function applyChange(scope: Scope, change: Change): Promise<void> {
	try {
		await assertAllowed(scope, change);
		await run(scope.ownerId, includingActor(scope, change));
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
