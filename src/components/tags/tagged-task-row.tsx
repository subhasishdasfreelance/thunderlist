import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import type { TaggedTask } from "#/queries/system";
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
		// The wrapper carries the row class, the same way every other list row in
		// the app does: it is what gives a row its own inline padding, so the row
		// is the full width of the card rather than inset from it.
		<div className="thunderlist-row">
			<HStack gap={2} hAlign="between" vAlign="center" paddingBlock={1.5}>
				<TaggedTitle title={task.title} tags={tags} isMuted={task.completed} />
				<Text type="supporting">{task.checklistTitle}</Text>
			</HStack>
		</div>
	);
}
