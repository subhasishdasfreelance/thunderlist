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
import { type AccessEntry, type AccessLevel, reaches } from "#/schemas/access";
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
import { assertLevel, isTaskVisible, levelOf } from "./visibility.server";

/** `actor` is who is asking, lower-cased; a tracker reading records it. */
async function run(
	userId: string,
	change: Change,
	actor: string,
): Promise<void> {
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
			await createProgressEntry(userId, change, actor);
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
 * In your own space there is nobody else, and everything is allowed. In a team
 * there are three questions and all of them have to say yes: their role has to
 * allow this kind of change at all; everyone the change names — to assign
 * something to, or to put on an access list — has to be in the team; and the
 * thing it reaches has to be one they are on the list for, far enough in to do
 * this to it. See `assertLevel`.
 *
 * A change that reaches something not on their list at all is answered as for
 * something deleted, because to them that is what it is.
 */
async function assertAllowed(scope: Scope, change: Change): Promise<void> {
	const { team } = scope;
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
			assertLevel(scope, "checklists", change.checklistId, "full");
			return;

		case "task.create":
			if (change.checklistId !== null) {
				assertLevel(scope, "checklists", change.checklistId, "full");
			}
			// Standing for something is only reading it: a task that waits on a
			// checklist or a tracker changes neither.
			if (change.linkedChecklistId != null) {
				assertLevel(scope, "checklists", change.linkedChecklistId, "read");
			}
			if (change.trackerId != null) {
				assertLevel(scope, "trackers", change.trackerId, "read");
			}
			return;

		case "tracker.update":
		case "tracker.delete":
			assertLevel(scope, "trackers", change.trackerId, "full");
			return;

		// A reading is the tracker moving on, not the tracker changing.
		case "entry.create":
		case "entry.update":
		case "entry.delete":
			assertLevel(scope, "trackers", change.trackerId, "edit");
			return;

		case "task.move":
			assertLevel(scope, "checklists", change.checklistId, "full");
			await assertTaskAllowed(scope, change.taskId, "full");
			return;

		case "task.delete":
			await assertTaskAllowed(scope, change.taskId, "full");
			return;

		case "task.update":
			await assertTaskAllowed(scope, change.taskId, "edit");
			return;

		case "tag.update":
		case "tag.delete":
			assertLevel(scope, "tags", change.tagId, "full");
			return;

		default:
			return;
	}
}

/** The addresses on an access list; see `accessSchema`. */
function listed(access: ReadonlyArray<AccessEntry> | null | undefined) {
	return (access ?? []).map((entry) => entry.email);
}

/** Everyone a change assigns something to, or puts on an access list. */
function namedPeople(change: Change): ReadonlyArray<string> {
	switch (change.kind) {
		case "checklist.create":
		case "tag.create":
			return listed(change.access);
		case "checklist.update":
		case "tag.update":
			return listed(change.patch.access);
		case "task.update":
			return change.patch.assignees ?? [];
		case "tracker.create":
			return [...change.assignees, ...listed(change.access)];
		case "tracker.update":
			return [
				...(change.patch.assignees ?? []),
				...listed(change.patch.access),
			];
		default:
			return [];
	}
}

/**
 * A task is reached through wherever it lives, so what may be done to it is
 * what may be done to that: its checklist, or — for one in the Inbox, which
 * belongs to no checklist of its own — the tags it carries; see
 * `isTaskVisible`.
 *
 * A task carrying several tags takes the best of them: it is one task, and
 * someone who runs any of the tags it is on runs it.
 */
async function assertTaskAllowed(
	scope: Scope,
	taskId: string,
	needed: AccessLevel,
): Promise<void> {
	const { hidden, levels } = scope;
	if (levels === null) return;

	const current = await collections();
	const task = await current.tasks.findOne(
		{ taskId, userId: scope.ownerId },
		{ projection: { _id: 0, checklistId: 1, tagIds: 1 } },
	);
	// Already gone, or never theirs: the write itself is the no-op that answers.
	if (!task) return;

	if (!isTaskVisible(task, hidden)) {
		throw new AppError("not_found", "That task no longer exists.");
	}

	if (task.checklistId != null && task.checklistId !== hidden.inboxId) {
		assertLevel(scope, "checklists", task.checklistId, needed);
		return;
	}

	// In the Inbox, or in no checklist at all: its tags decide. With none,
	// nobody has been kept from it and the role alone says.
	if (task.tagIds.length === 0) return;

	const allowed = task.tagIds.some((tagId) => {
		const level = levelOf(scope, "tags", tagId);
		return level !== null && reaches(level, needed);
	});

	if (!allowed) {
		throw new AppError(
			"invalid_data",
			needed === "edit"
				? "You can only read this task."
				: "You can work this task, but not add, delete or move it.",
		);
	}
}

/**
 * Whoever keeps a checklist, a tag or a tracker to a few people is one of them
 * and runs it, so the list they choose never locks them out of what they are
 * working on — nor leaves it with nobody who can change it again.
 */
function includingActor(scope: Scope, change: Change): Change {
	if (scope.team === null) return change;

	const including = (
		people: Array<AccessEntry> | null,
	): Array<AccessEntry> | null =>
		people === null || people.some((entry) => entry.email === scope.email)
			? people
			: [...people, { email: scope.email, level: "full" as const }];

	switch (change.kind) {
		case "checklist.create":
			return { ...change, access: including(change.access) };

		case "tag.create":
			return { ...change, access: including(change.access) };

		case "tracker.create":
			return { ...change, access: including(change.access) };

		case "checklist.update": {
			const { access } = change.patch;
			return access === undefined
				? change
				: { ...change, patch: { ...change.patch, access: including(access) } };
		}

		case "tracker.update": {
			const { access } = change.patch;
			return access === undefined
				? change
				: { ...change, patch: { ...change.patch, access: including(access) } };
		}

		case "tag.update": {
			const { access } = change.patch;
			return access === undefined
				? change
				: { ...change, patch: { ...change.patch, access: including(access) } };
		}

		default:
			return change;
	}
}

/** Log the real cause, hand back something a person can act on. */
export async function applyChange(scope: Scope, change: Change): Promise<void> {
	try {
		await assertAllowed(scope, change);
		await run(scope.ownerId, includingActor(scope, change), scope.email);
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
