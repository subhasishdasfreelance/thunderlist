import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { VStack } from "@astryxdesign/core/Stack";
import { MoreHorizontal } from "lucide-react";
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
import type { Task } from "#/schemas/task";
import { TASK_LIST_LABELS, type TaskListName } from "#/schemas/task-list";

export type TaskRowActions = TaskQuickActions & {
	onToggle: (completed: boolean) => void;
	onRename: () => void;
	onDelete: () => void;
};

/**
 * One task in a checklist, or on a tag's page among tasks from several.
 *
 * The four things done most often — planning a task for today, parking it, and
 * saying whether it is urgent or important — are buttons on the row itself
 * rather than entries buried in a menu. Each toggles, so a mistake costs one
 * click and the row never grows a third state.
 *
 * Every one of them also answers to a key while the pointer is over the row,
 * which is what makes going down a list quick: the pointer picks, the keyboard
 * acts, and nothing has to be selected first.
 *
 * Tags are highlighted inside the title, where they were typed, and are not
 * edited here: they are part of the text, so editing them is editing the task.
 * Everything rarer stays in the overflow menu.
 */
export function TaskRow({
	task,
	listState,
	tags,
	actions,
	checklist,
	onOpenList,
}: {
	task: Task;
	/** Which reference list this task is on, if any. */
	listState: TaskListName | null;
	tags: ReadonlyArray<Tag>;
	actions: TaskRowActions;
	/**
	 * The checklist the task lives in, on a screen that gathers tasks from many
	 * — a tag's. Left out on a checklist's own page, where the page is the
	 * answer. `null` is a task that belongs to no checklist.
	 */
	checklist?: { title: string | null; onOpen: () => void } | null;
	/**
	 * Opens the list holding a task that belongs to no checklist — the only
	 * place it lives — with the task ringed there.
	 */
	onOpenList?: (list: TaskListName) => void;
}) {
	const [isHovered, setIsHovered] = useState(false);

	/** Its state comes from a tracker, so nothing here may set it by hand. */
	const isTracked = task.trackerId !== null;
	/**
	 * On Today and in no checklist, taking it off Today deletes it, so it has no
	 * Today toggle here either; see `TaskRefRow`.
	 */
	const isLooseOnToday = checklist === null && listState === "today";

	const shortcuts = useMemo(
		() => ({
			[TASK_SHORTCUTS.today]: () => {
				if (isLooseOnToday) return;
				actions.onSetList(listState === "today" ? null : "today");
			},
			[TASK_SHORTCUTS.backlog]: () =>
				actions.onSetList(listState === "backlog" ? null : "backlog"),
			[TASK_SHORTCUTS.urgent]: () => actions.onSetUrgent(!task.urgent),
			[TASK_SHORTCUTS.important]: () => actions.onSetImportant(!task.important),
			[TASK_SHORTCUTS.complete]: () => {
				if (task.trackerId === null) actions.onToggle(!task.completed);
			},
			[TASK_SHORTCUTS.edit]: actions.onRename,
		}),
		[
			actions,
			listState,
			isLooseOnToday,
			task.urgent,
			task.important,
			task.completed,
			task.trackerId,
		],
	);

	useRowShortcuts(isHovered, shortcuts);

	const title = (
		<TaggedTitle title={task.title} tags={tags} isMuted={task.completed} />
	);

	// Where it lives is the way into it, as it is on Today: its checklist, or
	// for a task in no checklist, the list holding it.
	const crumb =
		checklist?.title != null
			? { title: checklist.title, onOpen: checklist.onOpen }
			: checklist === null && listState !== null && onOpenList
				? {
						title: TASK_LIST_LABELS[listState],
						onOpen: () => onOpenList(listState),
					}
				: null;

	return (
		/*
		 * One line where there is room, two where there is not.
		 *
		 * A title is the only part of a row worth reading, so it keeps the width:
		 * on a phone the buttons drop to a line of their own rather than squeezing
		 * it into three words a line. On a desktop everything sits on one line and
		 * the row stays as short as it can be.
		 */
		// biome-ignore lint/a11y/noStaticElementInteractions: resting the pointer here only arms the keyboard shortcuts; every action is also a real button.
		<div
			className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			{/* Second on a phone, first on a desktop: the flags join the other
			    buttons on the line below rather than crowding the title. */}
			<div className="order-2 flex shrink-0 items-center gap-0.5 md:order-none">
				<TaskFlagButtons
					title={task.title}
					urgent={task.urgent}
					important={task.important}
					actions={actions}
				/>
			</div>

			<div className="order-1 flex min-w-0 flex-1 basis-full items-center gap-2 md:order-none md:basis-0">
				{/* The label is hidden but still the accessible name; the visible
				    title is drawn beside it so its tags keep their place. */}
				{/*
				 * A task following a tracker is ticked by the tracker, not by hand.
				 * The box still shows the state — it is the honest answer to "is
				 * this done" — but it cannot be the thing that changes it.
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
				{crumb === null ? (
					title
				) : (
					<VStack gap={0}>
						{title}
						<button
							type="button"
							className="thunderlist-crumb"
							title={`Open ${crumb.title}`}
							onClick={crumb.onOpen}
						>
							{crumb.title}
						</button>
					</VStack>
				)}
			</div>

			<div className="order-3 ml-auto flex shrink-0 items-center gap-0.5 md:order-none md:ml-0">
				{isLooseOnToday ? null : (
					<TodayButton
						title={task.title}
						listState={listState}
						actions={actions}
					/>
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
						// Editing first: it is the reason this menu gets opened.
						{
							label: `Edit (${TASK_SHORTCUTS.edit})`,
							onClick: actions.onRename,
						},
						backlogMenuItem(listState, actions),
						{
							label: "Delete task",
							variant: "destructive" as const,
							onClick: actions.onDelete,
						},
					]}
				/>
			</div>
		</div>
	);
}
