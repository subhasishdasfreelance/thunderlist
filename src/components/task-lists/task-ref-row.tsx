import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { MoreHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { TaggedTitle } from "#/components/tags/tagged-title";
import {
	backlogMenuItem,
	TASK_SHORTCUTS,
	TaskFlagButtons,
	type TaskQuickActions,
	TodayButton,
} from "#/components/tasks/task-actions";
import { useRowShortcuts } from "#/lib/use-row-shortcuts";
import type { Tag } from "#/schemas/tag";
import type { TaskRefEntry } from "#/schemas/task-list";

export type TaskRefRowActions = TaskQuickActions & {
	onToggle: (completed: boolean) => void;
	onRemove: () => void;
	onMove: (direction: "up" | "down") => void;
	onOpenChecklist: () => void;
};

/**
 * One row of Today or Backlog.
 *
 * The checkbox writes to the task in its own checklist, not to this
 * list: completion has exactly one home, so Today and the checklist it came
 * from can never disagree about whether something is done.
 */
export function TaskRefRow({
	entry,
	tags,
	actions,
}: {
	entry: TaskRefEntry;
	tags: ReadonlyArray<Tag>;
	actions: TaskRefRowActions;
}) {
	const { task, checklistTitle, list } = entry;
	const [isHovered, setIsHovered] = useState(false);

	const shortcuts = useMemo(
		() => ({
			[TASK_SHORTCUTS.today]: () =>
				actions.onSetList(list === "today" ? null : "today"),
			[TASK_SHORTCUTS.backlog]: () =>
				actions.onSetList(list === "backlog" ? null : "backlog"),
			[TASK_SHORTCUTS.urgent]: () => actions.onSetUrgent(!task?.urgent),
			[TASK_SHORTCUTS.important]: () =>
				actions.onSetImportant(!task?.important),
			[TASK_SHORTCUTS.complete]: () => actions.onToggle(!task?.completed),
		}),
		[actions, list, task?.urgent, task?.important, task?.completed],
	);

	useRowShortcuts(isHovered && task !== null, shortcuts);

	// The referenced task or checklist has gone, most likely edited away in the
	// database. Say so plainly and let the user clear it.
	if (!task) {
		return (
			<HStack gap={2} vAlign="center" hAlign="between" paddingBlock={2}>
				<VStack gap={0.5}>
					<Text color="secondary">This task no longer exists</Text>
					<Text type="supporting">
						{checklistTitle ?? "Its checklist was removed"}
					</Text>
				</VStack>
				<IconButton
					label="Remove this stale item"
					tooltip="Remove"
					variant="ghost"
					size="sm"
					icon={<X aria-hidden />}
					onClick={actions.onRemove}
				/>
			</HStack>
		);
	}

	return (
		/* One line where there is room, two where there is not; see `TaskRow`. */
		// biome-ignore lint/a11y/noStaticElementInteractions: resting the pointer here only arms the keyboard shortcuts; every action is also a real button.
		<div
			className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className="flex min-w-0 flex-1 basis-full items-center gap-2 md:basis-0">
				<TaskFlagButtons
					title={task.title}
					urgent={task.urgent}
					important={task.important}
					actions={actions}
				/>

				<CheckboxInput
					label={task.title}
					isLabelHidden
					value={task.completed}
					onChange={actions.onToggle}
				/>
				<VStack gap={0}>
					<TaggedTitle
						title={task.title}
						tags={tags}
						isMuted={task.completed}
					/>
					{checklistTitle === null ? null : (
						<Text type="supporting">{checklistTitle}</Text>
					)}
				</VStack>
			</div>

			<div className="ml-auto flex shrink-0 items-center gap-0.5 md:ml-0">
				{/* The lit button for this list is also how a task leaves it, so there
				    is no separate remove: it would do the very same thing. */}
				<TodayButton title={task.title} listState={list} actions={actions} />

				<DropdownMenu
					hasChevron={false}
					placement="below"
					alignment="end"
					button={{
						label: `More actions: ${task.title}`,
						variant: "ghost",
						size: "sm",
						isIconOnly: true,
						icon: <MoreHorizontal aria-hidden />,
					}}
					items={[
						backlogMenuItem(list, actions),
						{ type: "divider" as const },
						{ label: "Move up", onClick: () => actions.onMove("up") },
						{ label: "Move down", onClick: () => actions.onMove("down") },
						{ type: "divider" as const },
						{ label: "Open checklist", onClick: actions.onOpenChecklist },
					]}
				/>
			</div>
		</div>
	);
}
