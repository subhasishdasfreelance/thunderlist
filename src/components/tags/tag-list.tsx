import { HStack } from "@astryxdesign/core/Stack";
import { Token } from "@astryxdesign/core/Token";
import type { Tag } from "#/schemas/tag";

/**
 * The tags on a task, shown but not edited.
 *
 * Tags are written into the title as `#name`, so this is a reading of the task
 * rather than a control: changing them means editing the task, which is where
 * the completion and the master list already live.
 */
export function TagList({
	tags,
	tagIds,
}: {
	/** Every tag that exists. Ids with no matching tag are simply not drawn. */
	tags: ReadonlyArray<Tag>;
	tagIds: ReadonlyArray<string>;
}) {
	const applied = tagIds.flatMap(
		(tagId) => tags.find((tag) => tag.tagId === tagId) ?? [],
	);

	if (applied.length === 0) return null;

	return (
		<HStack gap={1} wrap="wrap" vAlign="center">
			{applied.map((tag) => (
				<Token key={tag.tagId} size="sm" color={tag.color} label={tag.name} />
			))}
		</HStack>
	);
}
