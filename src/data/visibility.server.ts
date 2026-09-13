/**
 * Who can see what in a team. Server only.
 *
 * A checklist, a tag or a tracker in a team can be kept to some of its people;
 * see `visibleToSchema`. What it holds goes with it: a task in a checklist is
 * seen by whoever can see that checklist, and a task in the Inbox — which
 * belongs to no checklist of its own — by whoever can see one of its tags, or
 * by everyone if it has none. Today, the Backlog and the Inbox are everyone's.
 *
 * To anyone else, something kept from them does not exist: it is left out of
 * every list and search, and naming it by id is answered as for something
 * deleted. The team's admin and its viewers see everything, and in your own
 * space there is nobody to keep anything from, so for them nothing is hidden
 * and none of this costs a query.
 */

import { AppError } from "#/lib/errors";
import type { Collections } from "#/lib/mongo/client.server";

/** What one person may not see where they are working, by id. */
export type Hidden = {
	checklistIds: ReadonlySet<string>;
	tagIds: ReadonlySet<string>;
	trackerIds: ReadonlySet<string>;
	/**
	 * The space's Inbox, whose tasks are seen by their tags; see the top of
	 * this file. `null` where nothing is hidden, so it does not matter.
	 */
	inboxId: string | null;
};

export const NOTHING_HIDDEN: Hidden = {
	checklistIds: new Set(),
	tagIds: new Set(),
	trackerIds: new Set(),
	inboxId: null,
};

/**
 * The checklists, tags and trackers in a team kept to a list of people that
 * this person is not on.
 */
export async function readHidden(
	current: Collections,
	teamId: string,
	email: string,
): Promise<Hidden> {
	const keptFromThem = { $type: "array", $ne: email } as const;

	const [checklists, tags, trackers, inbox] = await Promise.all([
		current.checklists
			.find(
				{ userId: teamId, visibleTo: keptFromThem },
				{ projection: { _id: 0, checklistId: 1 } },
			)
			.toArray(),
		// Today and the Backlog are everyone's, whatever anyone has asked for.
		current.tags
			.find(
				{ userId: teamId, special: null, visibleTo: keptFromThem },
				{ projection: { _id: 0, tagId: 1 } },
			)
			.toArray(),
		current.trackers
			.find(
				{ userId: teamId, visibleTo: keptFromThem },
				{ projection: { _id: 0, trackerId: 1 } },
			)
			.toArray(),
		current.checklists.findOne(
			{ userId: teamId, special: "inbox" },
			{ projection: { _id: 0, checklistId: 1 } },
		),
	]);

	return {
		checklistIds: new Set(checklists.map((checklist) => checklist.checklistId)),
		tagIds: new Set(tags.map((tag) => tag.tagId)),
		trackerIds: new Set(trackers.map((tracker) => tracker.trackerId)),
		inboxId: inbox?.checklistId ?? null,
	};
}

/** Whether a task is seen, going by where it lives; see the top of this file. */
export function isTaskVisible(
	task: { checklistId: string | null; tagIds: ReadonlyArray<string> },
	hidden: Hidden,
): boolean {
	if (task.checklistId != null && task.checklistId !== hidden.inboxId) {
		return !hidden.checklistIds.has(task.checklistId);
	}

	return (
		task.tagIds.length === 0 ||
		task.tagIds.some((tagId) => !hidden.tagIds.has(tagId))
	);
}

export function assertChecklistVisible(
	hidden: Hidden,
	checklistId: string,
): void {
	if (hidden.checklistIds.has(checklistId)) {
		throw new AppError("not_found", "That checklist no longer exists.");
	}
}

export function assertTagVisible(hidden: Hidden, tagId: string): void {
	if (hidden.tagIds.has(tagId)) {
		throw new AppError("not_found", "That tag no longer exists.");
	}
}

export function assertTrackerVisible(hidden: Hidden, trackerId: string): void {
	if (hidden.trackerIds.has(trackerId)) {
		throw new AppError("not_found", "That tracker no longer exists.");
	}
}
