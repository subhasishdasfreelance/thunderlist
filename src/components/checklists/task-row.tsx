import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
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
import { specialTag, type Tag } from "#/schemas/tag";
import type { Task } from "#/schemas/task";

export type TaskRowActions = TaskQuickActions & {
	onToggle: (completed: boolean) => void;
	onRename: () => void;
	onDelete: () => void;
	/** Move it into another checklist. Left out where a screen offers no move. */
	onMove?: () => void;
};

/**
 * One task in a checklist, or on a tag's page among tasks from several.
 *
 * The four things done most often — putting a task on Today, parking it in the
 * Backlog, and saying whether it is urgent or important — are buttons on the
 * row itself rather than entries buried in a menu. Each toggles, so a mistake
 * costs one click and the row never grows a third state.
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
	tags,
	actions,
	checklist,
}: {
	task: Task;
	/** Every tag that exists: for the highlights, and for Today and the Backlog. */
	tags: ReadonlyArray<Tag>;
	actions: TaskRowActions;
	/**
	 * The checklist the task lives in, on a screen that gathers tasks from many
	 * — a tag's. Left out on a checklist's own page, where the page is the
	 * answer. `null` is a task that belongs to no checklist.
	 */
	checklist?: { title: string | null; onOpen: () => void } | null;
}) {
	const [isHovered, setIsHovered] = useState(false);

	/**
	 * Its state comes from a tracker or another checklist, so nothing here may
	 * set it by hand.
	 */
	const isTracked = task.trackerId !== null || task.linkedChecklistId != null;

	const today = specialTag(tags, "today");
	const backlog = specialTag(tags, "backlog");
	const isOnToday = today !== null && task.tagIds.includes(today.tagId);
	const isOnBacklog = backlog !== null && task.tagIds.includes(backlog.tagId);

	/*
	 * A task in no checklist lives under its tags, so it is never left with
	 * none. Taken off Today when that is its only tag, it is parked in the
	 * Backlog rather than vanishing; and when the Backlog is its only tag, it
	 * cannot be taken out — only put on Today, or deleted.
	 */
	const isOnlyUnder = (tag: Tag | null) =>
		checklist === null &&
		tag !== null &&
		task.tagIds.length === 1 &&
		task.tagIds[0] === tag.tagId;
	const isTodayItsHome = isOnlyUnder(today);
	const isBacklogItsHome = isOnlyUnder(backlog);

	const shortcuts = useMemo(
		() => ({
			[TASK_SHORTCUTS.today]: () => {
				if (today === null) return;
				if (isOnToday && isTodayItsHome) actions.onSetSpecial("backlog", true);
				else actions.onSetSpecial("today", !isOnToday);
			},
			[TASK_SHORTCUTS.backlog]: () => {
				if (backlog === null || (isOnBacklog && isBacklogItsHome)) return;
				actions.onSetSpecial("backlog", !isOnBacklog);
			},
			[TASK_SHORTCUTS.urgent]: () => actions.onSetUrgent(!task.urgent),
			[TASK_SHORTCUTS.important]: () => actions.onSetImportant(!task.important),
			[TASK_SHORTCUTS.complete]: () => {
				if (!isTracked) actions.onToggle(!task.completed);
			},
			[TASK_SHORTCUTS.edit]: actions.onRename,
		}),
		[
			actions,
			today,
			backlog,
			isOnToday,
			isOnBacklog,
			isTodayItsHome,
			isBacklogItsHome,
			task.urgent,
			task.important,
			task.completed,
			isTracked,
		],
	);

	useRowShortcuts(isHovered, shortcuts);

	const title = (
		<TaggedTitle
			title={task.title}
			tags={tags}
			tagIds={task.tagIds}
			isMuted={task.completed}
		/>
	);

	// Where it lives is the way into it: the checklist, on a screen that is not
	// that checklist's own.
	const crumb = checklist?.title != null ? checklist : null;

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
						task.linkedChecklistId != null
							? "Finishes when its checklist does."
							: isTracked
								? "Finishes when its tracker does."
								: undefined
					}
					onChange={actions.onToggle}
				/>
				{crumb === null && !task.caption ? (
					title
				) : (
					<VStack gap={0}>
						{title}
						{task.caption ? (
							<Text type="supporting">{task.caption}</Text>
						) : null}
						{crumb === null ? null : (
							<button
								type="button"
								className="thunderlist-crumb"
								title={`Open ${crumb.title}`}
								onClick={crumb.onOpen}
							>
								{crumb.title}
							</button>
						)}
					</VStack>
				)}
			</div>

			<div className="order-3 ml-auto flex shrink-0 items-center gap-0.5 md:order-none md:ml-0">
				{today === null ? null : (
					<TodayButton
						title={task.title}
						today={today}
						isOn={isOnToday}
						onToggle={shortcuts[TASK_SHORTCUTS.today]}
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
						...(actions.onMove === undefined
							? []
							: [{ label: "Move to checklist…", onClick: actions.onMove }]),
						...(backlog === null || (isOnBacklog && isBacklogItsHome)
							? []
							: [
									backlogMenuItem(
										backlog,
										isOnBacklog,
										shortcuts[TASK_SHORTCUTS.backlog],
									),
								]),
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
