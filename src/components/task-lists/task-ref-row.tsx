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
	onEdit: () => void;
	/** `null` for a task that belongs to no checklist. */
	onOpenChecklist: (() => void) | null;
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
	canReorder,
}: {
	entry: TaskRefEntry;
	tags: ReadonlyArray<Tag>;
	actions: TaskRefRowActions;
	/** False while the list is sorted, when a hand-made position means nothing. */
	canReorder: boolean;
}) {
	const { task, checklistId, checklistTitle, list } = entry;

	/** Its state comes from a tracker, so nothing here may set it by hand. */
	const isTracked = task?.trackerId != null;
	/**
	 * On Today and in no checklist, taking it off Today deletes it: there is
	 * nowhere else for it to live. So it has no Today toggle — that would be a
	 * delete button that looks like something milder.
	 */
	const isLooseOnToday = list === "today" && checklistId === null;
	const [isHovered, setIsHovered] = useState(false);

	const shortcuts = useMemo(
		() => ({
			[TASK_SHORTCUTS.today]: () => {
				if (isLooseOnToday) return;
				actions.onSetList(list === "today" ? null : "today");
			},
			[TASK_SHORTCUTS.backlog]: () =>
				actions.onSetList(list === "backlog" ? null : "backlog"),
			[TASK_SHORTCUTS.urgent]: () => actions.onSetUrgent(!task?.urgent),
			[TASK_SHORTCUTS.important]: () =>
				actions.onSetImportant(!task?.important),
			[TASK_SHORTCUTS.complete]: () => {
				if (task?.trackerId == null) actions.onToggle(!task?.completed);
			},
			[TASK_SHORTCUTS.edit]: actions.onEdit,
		}),
		[
			actions,
			list,
			isLooseOnToday,
			task?.urgent,
			task?.important,
			task?.completed,
			task?.trackerId,
		],
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
			{/* Second on a phone, first on a desktop: the flags sit with the other
			    buttons on the line below rather than in front of the title. */}
			<div className="order-2 flex shrink-0 items-center gap-0.5 md:order-none">
				<TaskFlagButtons
					title={task.title}
					urgent={task.urgent}
					important={task.important}
					actions={actions}
				/>
			</div>

			<div className="order-1 flex min-w-0 flex-1 basis-full items-center gap-2 md:order-none md:basis-0">
				{/*
				 * A task following a tracker is ticked by the tracker, not by hand.
				 * The box still shows the state — it is the honest answer to "is
				 * this done" — but it cannot be the thing that changes it, and the
				 * tooltip says where to go instead of leaving a dead control.
				 */}
				<CheckboxInput
					label={task.title}
					isLabelHidden
					value={task.completed}
					isDisabled={isTracked}
					disabledMessage={
						isTracked ? "Finishes when its tracker does." : undefined
					}
					onChange={actions.onToggle}
				/>
				<VStack gap={0}>
					<TaggedTitle
						title={task.title}
						tags={tags}
						isMuted={task.completed}
					/>
					{/*
					 * The checklist name is the way into it, with this task in view.
					 * A row that names where something lives should take you there;
					 * a separate "open checklist" in the menu was the same trip with
					 * an extra stop.
					 */}
					{checklistTitle === null ? null : actions.onOpenChecklist ? (
						/*
						 * Small and quiet: it names where the task lives and takes you
						 * there, but it is a footnote to the title above it, not an
						 * action competing with the buttons on the row.
						 */
						<button
							type="button"
							className="thunderlist-crumb"
							title={`Open ${checklistTitle}`}
							onClick={actions.onOpenChecklist}
						>
							{checklistTitle}
						</button>
					) : null}
				</VStack>
			</div>

			<div className="order-3 ml-auto flex shrink-0 items-center gap-0.5 md:order-none md:ml-0">
				{/* The lit button for this list is also how a task leaves it, so there
				    is no separate remove: it would do the very same thing. */}
				{isLooseOnToday ? null : (
					<TodayButton title={task.title} listState={list} actions={actions} />
				)}

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
						{
							label: `Edit (${TASK_SHORTCUTS.edit})`,
							onClick: actions.onEdit,
						},
						backlogMenuItem(list, actions),
						// Moving a row by hand only means something while the list is in
						// the order you put it in. Sorted, the position is derived and
						// the buttons would promise something they cannot do.
						...(canReorder
							? [
									{ type: "divider" as const },
									{ label: "Move up", onClick: () => actions.onMove("up") },
									{
										label: "Move down",
										onClick: () => actions.onMove("down"),
									},
								]
							: []),
					]}
				/>
			</div>
		</div>
	);
}
