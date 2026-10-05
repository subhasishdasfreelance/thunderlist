import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { ChecklistCard } from "#/components/checklists/checklist-card";
import { TrackerCard } from "#/components/trackers/tracker-card";
import { checklistsQuery } from "#/queries/checklists";
import { tagSummariesQuery, tagsQuery } from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import { TagCard } from "./tag-card";

/**
 * The checklists, trackers and tags marked as current focus; see
 * `FocusButton`. Each is itself, not the tasks it holds. Read only where
 * they are shown: `isEnabled`.
 */
export function useFocusedItems(isEnabled: boolean) {
	const checklists =
		useQuery({ ...checklistsQuery(), enabled: isEnabled }).data ?? [];
	const trackers =
		useQuery({ ...trackersQuery(), enabled: isEnabled }).data ?? [];
	const tags =
		useQuery({ ...tagSummariesQuery(), enabled: isEnabled }).data ?? [];

	return {
		checklists: checklists.filter((each) => each.focused === true),
		trackers: trackers.filter((each) => each.focused === true),
		tags: tags.filter((each) => each.focused === true),
	};
}

/**
 * The Current focus tag's page, above its tasks: the cards of everything else
 * marked as current focus, two to a row where there is room, as on their own
 * screens.
 */
export function FocusedItems({
	items,
}: {
	items: ReturnType<typeof useFocusedItems>;
}) {
	const allTags = useQuery(tagsQuery()).data ?? [];
	if (
		items.checklists.length + items.trackers.length + items.tags.length ===
		0
	) {
		return null;
	}

	return (
		<VStack gap={2}>
			<Text type="label" weight="semibold" color="secondary">
				In focus
			</Text>
			<div className="thunderlist-card-grid">
				{items.checklists.map((checklist) => (
					<ChecklistCard key={checklist.checklistId} checklist={checklist} />
				))}
				{items.trackers.map((tracker) => (
					<TrackerCard
						key={tracker.trackerId}
						tracker={tracker}
						tags={allTags}
					/>
				))}
				{items.tags.map((tag) => (
					<TagCard key={tag.tagId} tag={tag} />
				))}
			</div>
		</VStack>
	);
}
