import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { checklistsQuery } from "#/queries/checklists";
import { tagSummariesQuery } from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import type { ChecklistSummary } from "#/schemas/checklist";
import type { Group } from "#/schemas/group";
import type { TagSummary } from "#/schemas/tag";
import type { TrackerSummary } from "#/schemas/tracker";

/** What a group holds, as this person can see it; see `useGroupContents`. */
export type GroupContents = {
	checklists: Array<ChecklistSummary>;
	trackers: Array<TrackerSummary>;
	tags: Array<TagSummary>;
	count: number;
	/**
	 * How far along it all is, 0-100: the average of each thing's own share
	 * done, so a tracker counts as much as a checklist. `null` when empty.
	 */
	percent: number | null;
};

/**
 * Turn a group's items into the things themselves, with their figures.
 *
 * An item naming something deleted, or kept from this person, is not drawn;
 * see `Group`.
 */
export function useGroupContents(): {
	contentsOf: (group: Group) => GroupContents;
	isPending: boolean;
} {
	const checklists = useQuery(checklistsQuery());
	const trackers = useQuery(trackersQuery());
	const tags = useQuery(tagSummariesQuery());

	const maps = useMemo(
		() => ({
			checklists: new Map(
				(checklists.data ?? []).map((each) => [each.checklistId, each]),
			),
			trackers: new Map(
				(trackers.data ?? []).map((each) => [each.trackerId, each]),
			),
			tags: new Map((tags.data ?? []).map((each) => [each.tagId, each])),
		}),
		[checklists.data, trackers.data, tags.data],
	);

	const contentsOf = useCallback(
		(group: Group): GroupContents => {
			const pick = <T>(kind: string, from: Map<string, T>) =>
				group.items.flatMap((item) => {
					const found = item.kind === kind ? from.get(item.id) : undefined;
					return found === undefined ? [] : [found];
				});

			const held = {
				checklists: pick("checklist", maps.checklists),
				trackers: pick("tracker", maps.trackers),
				tags: pick("tag", maps.tags),
			};
			const percents = [
				...held.checklists.map((each) => each.progress.percent),
				...held.trackers.map((each) => each.progress.percent),
				...held.tags.map((each) => each.progress.percent),
			];

			return {
				...held,
				count: percents.length,
				percent:
					percents.length === 0
						? null
						: Math.round(
								percents.reduce((sum, each) => sum + each, 0) / percents.length,
							),
			};
		},
		[maps],
	);

	return {
		contentsOf,
		isPending: checklists.isPending || trackers.isPending || tags.isPending,
	};
}

/** "2 checklists · 1 tracker", leaving out the kinds it has none of. */
export function describeContents(contents: GroupContents): string {
	const part = (count: number, noun: string) =>
		count === 0 ? [] : [`${count} ${noun}${count === 1 ? "" : "s"}`];

	const parts = [
		...part(contents.checklists.length, "checklist"),
		...part(contents.trackers.length, "tracker"),
		...part(contents.tags.length, "tag"),
	];
	return parts.length === 0 ? "Empty" : parts.join(" · ");
}
