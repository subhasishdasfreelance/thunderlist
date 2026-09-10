import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useNavigate } from "@tanstack/react-router";
import type { TaggedTask } from "#/queries/system";
import type { Tag } from "#/schemas/tag";
import { TASK_LIST_LABELS } from "#/schemas/task-list";
import { TaggedTitle } from "./tagged-title";

/**
 * A task as the Tags and Priority screens list it: what it is, where it lives,
 * and the tags it carries.
 *
 * Read-only, like every task row. Pressing it opens the task where it lives,
 * with the task ringed: its checklist, or for a task in no checklist, the list
 * holding it. That is where it is edited — tags included, since they are
 * written into the title as `#name`. A task on neither has nowhere to open, so
 * it is a plain row rather than a link.
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
	const { checklistId, list } = task;

	const open =
		checklistId !== null
			? () =>
					void navigate({
						to: "/checklists/$checklistId",
						params: { checklistId },
						search: { task: task.taskId },
					})
			: list !== null
				? () =>
						void navigate({
							to: list === "today" ? "/today" : "/backlog",
							search: { task: task.taskId },
						})
				: null;

	// Named on the row, so it says where pressing it goes.
	const home =
		task.checklistTitle ?? (list === null ? null : TASK_LIST_LABELS[list]);

	const content = (
		<HStack gap={2} hAlign="between" vAlign="center" paddingBlock={1.5}>
			<TaggedTitle title={task.title} tags={tags} isMuted={task.completed} />
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
