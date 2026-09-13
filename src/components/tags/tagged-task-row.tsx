import { Divider } from "@astryxdesign/core/Divider";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useNavigate } from "@tanstack/react-router";
import type { TaggedTask } from "#/queries/system";
import { type Tag, tagParam, tagsFor } from "#/schemas/tag";
import { TaggedTitle } from "./tagged-title";

/**
 * A task as the Tags screens list it: what it is, where it lives, and the tags
 * it carries.
 *
 * Read-only, like every task row. Pressing it opens the task where it lives,
 * with the task ringed: its checklist, or for a task in no checklist, the page
 * of the first tag it carries — usually Today's. That is where it is edited —
 * tags included, since they are written into the title as `#name`. A task with
 * neither has nowhere to open, so it is a plain row rather than a link.
 */
export function TaggedTaskRow({
	task,
	tags,
	hasDivider,
}: {
	task: TaggedTask;
	tags: ReadonlyArray<Tag>;
	/** Every row but the first is ruled off from the one above it. */
	hasDivider: boolean;
}) {
	const navigate = useNavigate();
	const { checklistId } = task;

	// A task in no checklist lives under its tags; the first is its page.
	const homeTag =
		checklistId === null ? (tagsFor(task.tagIds, tags)[0] ?? null) : null;

	const open =
		checklistId !== null
			? () =>
					void navigate({
						to: "/checklists/$checklistId",
						params: { checklistId },
						search: { task: task.taskId },
					})
			: homeTag !== null
				? () =>
						void navigate({
							to: "/tags/$tagId",
							params: { tagId: tagParam(homeTag) },
							search: { task: task.taskId },
						})
				: null;

	// Named on the row, so it says where pressing it goes.
	const home =
		task.checklistTitle ?? (homeTag === null ? null : `#${homeTag.name}`);

	const title = (
		<TaggedTitle
			title={task.title}
			tags={tags}
			tagIds={task.tagIds}
			isMuted={task.completed}
		/>
	);

	const content = (
		<HStack gap={2} hAlign="between" vAlign="center" paddingBlock={1.5}>
			{task.caption ? (
				<VStack gap={0}>
					{title}
					<Text type="supporting">{task.caption}</Text>
				</VStack>
			) : (
				title
			)}
			{home === null ? null : <Text type="supporting">{home}</Text>}
		</HStack>
	);

	return (
		// The wrapper carries the row class, the same way every other list row in
		// the app does: it is what gives a row its own inline padding, so the row
		// is the full width of the card rather than inset from it.
		<div className="thunderlist-row">
			{hasDivider ? <Divider /> : null}
			{open === null ? (
				content
			) : (
				<button
					type="button"
					className="thunderlist-task-row w-full cursor-pointer text-left"
					onClick={open}
				>
					{content}
				</button>
			)}
		</div>
	);
}
