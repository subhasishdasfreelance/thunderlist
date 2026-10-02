import { checklistsBehind, tagsBehind, trackersBehind } from "#/lib/behind";
import { type ListOrder, manualOrder } from "#/schemas/arrangement";
import type { Group } from "#/schemas/group";
import { PRIORITY_RANKS, priorityRank } from "#/schemas/task";
import type { GroupContents } from "./group-contents";

type Flags = { urgent?: boolean; important?: boolean };

/** Where a card's priority puts it, urgent and important first. */
function rankOf(item: Flags): number {
	return PRIORITY_RANKS.indexOf(
		priorityRank({
			urgent: item.urgent ?? false,
			important: item.important ?? false,
		}),
	);
}

/**
 * What a group holds, each kind in the order picked; see `ListOrderMenu`.
 *
 * Its own order is the group's, set with Arrange; see `Group.order`. Newest
 * is the newest put into the group, read from `items`, which keep the order
 * they were added in. Most behind is judged at `now`, the viewer's clock, and
 * waits for it; priority ranks as a task's does. Both keep the group's own
 * order among cards they rank alike.
 */
export function orderContents(
	group: Group,
	contents: GroupContents,
	order: ListOrder,
	now: number | null,
): GroupContents {
	const added = new Map(group.items.map((item, at) => [item.id, at]));

	function arrange<T extends Flags>(
		items: Array<T>,
		idOf: (item: T) => string,
		behind: (now: number) => (a: T, b: T) => number,
	): Array<T> {
		if (order === "newest") {
			return [...items].sort(
				(a, b) => (added.get(idOf(b)) ?? -1) - (added.get(idOf(a)) ?? -1),
			);
		}
		const byHand = manualOrder(items, idOf, group.order ?? []);
		if (order === "behind" && now !== null) return byHand.sort(behind(now));
		if (order === "priority") {
			return byHand.sort((a, b) => rankOf(a) - rankOf(b));
		}
		return byHand;
	}

	return {
		...contents,
		checklists: arrange(
			contents.checklists,
			(checklist) => checklist.checklistId,
			checklistsBehind,
		),
		trackers: arrange(
			contents.trackers,
			(tracker) => tracker.trackerId,
			trackersBehind,
		),
		tags: arrange(contents.tags, (tag) => tag.tagId, tagsBehind),
	};
}

/**
 * Everything the group holds as rows to arrange, in its own order; see
 * `ArrangeDialog`. A kind at a time, as the page draws them.
 */
export function arrangeRows(
	group: Group,
	contents: GroupContents,
): Array<{ id: string; label: string }> {
	const byHand = orderContents(group, contents, "manual", null);
	return [
		...byHand.checklists.map((each) => ({
			id: each.checklistId,
			label: each.title,
		})),
		...byHand.trackers.map((each) => ({
			id: each.trackerId,
			label: each.title,
		})),
		...byHand.tags.map((each) => ({ id: each.tagId, label: `#${each.name}` })),
	];
}
