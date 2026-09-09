import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import type { TaggedTask } from "#/lib/pending/overlay-tags";
import type { Tag } from "#/schemas/tag";
import { TaggedTaskRow } from "./tagged-task-row";

/**
 * One tag with the tasks carrying it.
 *
 * The bar is how far through those tasks you are: a tag is a slice of work
 * across checklists, and the only question worth asking about a slice is how
 * much of it is left.
 */
export function TagCard({
	tag,
	tasks,
	allTags,
	onEdit,
	onDelete,
}: {
	tag: Tag;
	tasks: ReadonlyArray<TaggedTask>;
	allTags: ReadonlyArray<Tag>;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const done = tasks.filter((task) => task.completed).length;
	const percent =
		tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);

	return (
		<Card padding={0}>
			<VStack gap={2} paddingInline={4} paddingBlock={3}>
				<HStack gap={2} hAlign="between" vAlign="center">
					<HStack gap={2} vAlign="center">
						<Token size="md" color={tag.color} label={tag.name} />
						<Text type="supporting">
							{done} of {tasks.length} done
						</Text>
					</HStack>

					<DropdownMenu
						hasChevron={false}
						placement="below"
						alignment="end"
						button={{
							label: `Actions for tag ${tag.name}`,
							variant: "ghost",
							size: "sm",
						}}
						items={[
							{ label: "Rename or recolour", onClick: onEdit },
							{
								label: "Delete tag",
								variant: "destructive" as const,
								onClick: onDelete,
							},
						]}
					/>
				</HStack>

				{tasks.length === 0 ? null : (
					<ProgressBar
						label={`${tag.name} progress`}
						isLabelHidden
						value={percent}
					/>
				)}
			</VStack>

			<Divider />

			<VStack gap={0} paddingInline={4} paddingBlock={2}>
				{tasks.length === 0 ? (
					<Text type="supporting">Nothing carries this tag yet.</Text>
				) : (
					tasks.map((task) => (
						<TaggedTaskRow
							key={`${tag.tagId}:${task.taskId}`}
							task={task}
							tags={allTags}
						/>
					))
				)}
			</VStack>
		</Card>
	);
}
