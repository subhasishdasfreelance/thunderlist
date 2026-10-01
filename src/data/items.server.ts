/**
 * Things picked out on their screens, changed together. Server only.
 */

import { collections } from "#/lib/mongo/client.server";
import type { AccessEntry } from "#/schemas/access";
import type { ShareableKind } from "#/schemas/change";

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
