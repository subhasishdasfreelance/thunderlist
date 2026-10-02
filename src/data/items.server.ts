/**
 * Things picked out on their screens, changed together. Server only.
 */

import { AppError } from "#/lib/errors";
import { collections } from "#/lib/mongo/client.server";
import type { AccessEntry } from "#/schemas/access";
import type { ItemsPatch, ShareableKind } from "#/schemas/change";
import { MAX_TAGS } from "#/schemas/common";
import { retagManyTasks } from "./checklist.server";

/**
 * Give several checklists, trackers or tags one access list — a pick of them
 * shared at once — in one write. The Inbox, the Backlog and Today keep none:
 * they are everyone's; see `updateChecklist`.
 *
 * Written with a list of its own, each stops being read from the old field;
 * leaving both would mean two answers to the same question.
 */
export async function shareItems(
	userId: string,
	of: ShareableKind,
	ids: ReadonlyArray<string>,
	access: ReadonlyArray<AccessEntry> | null,
): Promise<void> {
	const current = await collections();
	const update = {
		$set: {
			access: access === null ? null : [...access],
			updatedAt: new Date().toISOString(),
		},
		$unset: { visibleTo: "" as const },
	};
	const among = { $in: [...ids] };

	switch (of) {
		case "checklist":
			await current.checklists.updateMany(
				{ userId, checklistId: among, special: null },
				update,
			);
			return;
		case "tracker":
			await current.trackers.updateMany({ userId, trackerId: among }, update);
			return;
		case "tag":
			await current.tags.updateMany(
				{ userId, tagId: among, special: null },
				update,
			);
			return;
	}
}

/**
 * Give several checklists, trackers and tags — of one kind, or a group's mix —
 * one schedule or priority, or add tags to them or take tags off, in one write a kind;
 * see `itemsPatchSchema`. A tracker has no daily window, and a tag carries no
 * tags, so each is given only what it has.
 *
 * A checklist's tasks carry its tags, so they gain and lose them too, first,
 * as for one checklist; see `updateChecklist`. A tag is only taken off a
 * checklist's tasks where the checklist had it, so a task tagged by hand
 * keeps it.
 */
export async function updateItems(
	userId: string,
	items: ReadonlyArray<{ kind: ShareableKind; id: string }>,
	patch: ItemsPatch,
): Promise<void> {
	const current = await collections();
	const { addTagIds = [], removeTagIds = [], dailyWindow, ...fields } = patch;
	const idsOf = (kind: ShareableKind) =>
		items.filter((item) => item.kind === kind).map((item) => item.id);
	const checklistIds = idsOf("checklist");
	const trackerIds = idsOf("tracker");
	const tagIds = idsOf("tag");

	const set = { ...fields, updatedAt: new Date().toISOString() };
	const withWindow = dailyWindow === undefined ? set : { ...set, dailyWindow };
	const isRetagging = addTagIds.length > 0 || removeTagIds.length > 0;
	const retag = [
		...(addTagIds.length === 0
			? []
			: [{ $addToSet: { tagIds: { $each: addTagIds } } }]),
		...(removeTagIds.length === 0
			? []
			: [{ $pull: { tagIds: { $in: removeTagIds } } }]),
	];

	if (checklistIds.length > 0) {
		const filter = { userId, checklistId: { $in: checklistIds } };
		if (isRetagging) {
			const before = await current.checklists
				.find(filter, { projection: { _id: 0, checklistId: 1, tagIds: 1 } })
				.toArray();
			assertTagRoom(before, addTagIds, removeTagIds);
			await retagManyTasks(
				current,
				userId,
				before.map((checklist) => {
					const had = checklist.tagIds ?? [];
					return {
						checklistId: checklist.checklistId,
						added: addTagIds.filter((tagId) => !had.includes(tagId)),
						removed: removeTagIds.filter((tagId) => had.includes(tagId)),
					};
				}),
			);
		}
		// Added and taken off apart: one update can't do both to one field.
		await current.checklists.bulkWrite(
			[{ $set: withWindow }, ...retag].map((update) => ({
				updateMany: { filter, update },
			})),
		);
	}

	if (trackerIds.length > 0) {
		const filter = { userId, trackerId: { $in: trackerIds } };
		if (isRetagging) {
			assertTagRoom(
				await current.trackers
					.find(filter, { projection: { _id: 0, tagIds: 1 } })
					.toArray(),
				addTagIds,
				removeTagIds,
			);
		}
		await current.trackers.bulkWrite(
			[{ $set: set }, ...retag].map((update) => ({
				updateMany: { filter, update },
			})),
		);
	}

	if (tagIds.length > 0) {
		await current.tags.updateMany(
			{ userId, tagId: { $in: tagIds } },
			{ $set: withWindow },
		);
	}
}

/** Refuse tags that would take any of these past what one thing carries. */
function assertTagRoom(
	before: ReadonlyArray<{ tagIds?: ReadonlyArray<string> | null }>,
	adding: ReadonlyArray<string>,
	removing: ReadonlyArray<string>,
): void {
	const isOver = before.some(
		(each) =>
			new Set([
				...(each.tagIds ?? []).filter((tagId) => !removing.includes(tagId)),
				...adding,
			]).size > MAX_TAGS,
	);
	if (isOver) {
		throw new AppError(
			"invalid_data",
			`At most ${MAX_TAGS} tags can be applied to each one.`,
		);
	}
}
