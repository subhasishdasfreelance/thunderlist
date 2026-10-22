import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { ChecklistCard } from "#/components/checklists/checklist-card";
import { TrackerCard } from "#/components/trackers/tracker-card";
import { checklistsQuery } from "#/queries/checklists";
import { tagSummariesQuery, tagsQuery } from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import { SPECIAL_FLAGS, type SpecialTag } from "#/schemas/tag";
import { TagCard } from "./tag-card";

/**
 * The checklists, trackers and tags marked for a special tag — on Today, or
 * as current focus; see `ItemFlagButtons`. Each is itself, not the tasks it
 * holds. Read only on a special tag's page: `null` reads nothing.
 */
export function useMarkedItems(special: SpecialTag | null) {
	const isEnabled = special !== null;
	const checklists =
		useQuery({ ...checklistsQuery(), enabled: isEnabled }).data ?? [];
	const trackers =
		useQuery({ ...trackersQuery(), enabled: isEnabled }).data ?? [];
	const tags =
		useQuery({ ...tagSummariesQuery(), enabled: isEnabled }).data ?? [];

	if (special === null) return { checklists: [], trackers: [], tags: [] };
	const field = SPECIAL_FLAGS[special];

	return {
		checklists: checklists.filter((each) => each[field] === true),
		trackers: trackers.filter((each) => each[field] === true),
		tags: tags.filter((each) => each[field] === true),
	};
}

/** What the cards are listed under, on each special tag's page. */
const HEADINGS: Record<SpecialTag, string> = {
	today: "For today",
	focus: "In focus",
};

/**
 * A special tag's page, above its tasks: the cards of everything else marked
 * for it, two to a row where there is room, as on their own screens.
 */
export function MarkedItems({
	special,
	items,
}: {
	special: SpecialTag;
	items: ReturnType<typeof useMarkedItems>;
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
				{HEADINGS[special]}
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
