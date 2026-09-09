import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import type { TaggedTask } from "#/lib/pending/overlay-tags";
import type { Tag } from "#/schemas/tag";
import { TaggedTitle } from "./tagged-title";

/**
 * A task as it appears on the Tags screen: what it is, where it lives, and the
 * tags it carries.
 *
 * Read-only, like every task row. Tags are written into the title as `#name`,
 * so they are changed by editing the task in its checklist.
 */
export function TaggedTaskRow({
	task,
	tags,
}: {
	task: TaggedTask;
	tags: ReadonlyArray<Tag>;
}) {
	return (
		<HStack gap={2} hAlign="between" vAlign="center" paddingBlock={1.5}>
			<TaggedTitle title={task.title} tags={tags} isMuted={task.completed} />
			<Text type="supporting">{task.checklistTitle}</Text>
		</HStack>
	);
}
