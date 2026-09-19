import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import {
	Check,
	FolderInput,
	MoreHorizontal,
	Pencil,
	Shapes,
	Tag as TagIcon,
	Trash2,
	UserCheck,
	UserMinus,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { StageDot, stageColorStyle } from "#/components/common/stage-dot";
import { TaggedTitle } from "#/components/tags/tagged-title";
import {
	backlogMenuItem,
	ShortcutKey,
	TASK_SHORTCUTS,
	TaskFlagButtons,
	type TaskQuickActions,
	TodayButton,
} from "#/components/tasks/task-actions";
import { Assignees } from "#/components/teams/assignees";
import { useRowShortcuts } from "#/lib/use-row-shortcuts";
import { useTaskTypes } from "#/lib/use-task-types";
import { usePermissions, useSpace } from "#/lib/use-team";
import { type Stage, stageColor, stageOf } from "#/schemas/checklist";
import { specialTag, type Tag } from "#/schemas/tag";
import type { Task } from "#/schemas/task";

export type TaskRowActions = TaskQuickActions & {
	onToggle: (completed: boolean) => void;
	onRename: () => void;
	onDelete: () => void;
	/** Say what kind of work it is; see `TaskTypeDialog`. */
	onSetType: () => void;
	/** Put a tag on it, picked from the list; see `TagPickerDialog`. */
	onAddTag: () => void;
	/** Move it into another checklist. Left out where a screen offers no move. */
	onMove?: () => void;
	/** Move it to another of its checklist's stages; see `Checklist.stages`. */
	onSetStage?: (stageId: string) => void;
	/** Assign it to people in the team. Left out outside a team. */
	onAssign?: () => void;
	/**
	 * Assign it to whoever is looking, or take them off it — Space. Left out
	 * outside a team.
	 */
	onToggleMine?: () => void;
};

/**
 * One task in a checklist, or on a page among tasks from several.
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
 * Its type is drawn under the title beside the rest of the small print, as a
 * tag without the hash and in italics — a task carries one and it is given to
 * it rather than typed, so it reads as a label on the task rather than as a
 * word in it. Everything rarer stays in the overflow menu.
 *
 * For someone who may only look — a viewer, in a team — the row is the task
 * and nothing to press.
 */
export function TaskRow({
	task,
	tags,
	actions,
	backlog,
	checklist,
	stages,
	isStageShown = false,
}: {
	task: Task;
	/** Every tag that exists: for the highlights, and for Today. */
	tags: ReadonlyArray<Tag>;
	actions: TaskRowActions;
	/**
	 * The Backlog, to park the task in: its name, and moving the task there.
	 * Left out where the task is in it already, or a screen offers no move.
	 */
	backlog?: { title: string; onMove: () => void };
	/**
	 * The checklist the task lives in, on a screen that gathers tasks from many
	 * — a tag's. Left out on a checklist's own page, where the page is the
	 * answer. `null` while that is not known yet.
	 */
	checklist?: { title: string | null; onOpen: () => void } | null;
	/**
	 * Its checklist's stages. Ticking it sends it on to the next one; the menu
	 * sends it to any of them, done included.
	 */
	stages?: ReadonlyArray<Stage>;
	/**
	 * Say which of its checklist's stages it is at, on a screen that does not —
	 * a tag's. Only for a checklist with stages of its own: with just the two it
	 * starts with, the checkbox already says it.
	 */
	isStageShown?: boolean;
}) {
	const [isHovered, setIsHovered] = useState(false);
	const { canManageContent, canUpdateTasks } = usePermissions();
	const me = useSpace()?.email;
	const isMine = me !== undefined && (task.assignees ?? []).includes(me);
	const type =
		useTaskTypes().find((each) => each.typeId === task.typeId) ?? null;

	/**
	 * Its state comes from a tracker or another checklist, so nothing here may
	 * set it by hand.
	 */
	const isTracked = task.trackerId !== null || task.linkedChecklistId != null;

	const today = specialTag(tags, "today");
	const isOnToday = today !== null && task.tagIds.includes(today.tagId);
	// Parking it is moving it to another checklist, a project manager's to do;
	// see `Capability`.
	const park = canManageContent ? backlog : undefined;

	// Only a checklist with stages of its own has anywhere to move a task along.
	const movable = stages !== undefined && stages.length > 2 ? stages : null;
	const stageId = movable === null ? null : stageOf(task, movable);
	const stageIndex =
		movable === null
			? -1
			: movable.findIndex((stage) => stage.stageId === stageId);
	const lastStageId = movable?.[movable.length - 1].stageId;
	// The last stage is done, which a task following something cannot be made.
	const reachable = (movable ?? []).filter(
		(stage) => !isTracked || stage.stageId !== lastStageId,
	);
	const nextStage =
		movable === null
			? null
			: (reachable.find((_, at) => at > stageIndex) ?? null);
	const shownStage =
		isStageShown && movable !== null ? movable[stageIndex] : null;

	/**
	 * The colour of the stage it is at, worn by its checkbox — none at the
	 * first, where nothing has started; see `stageColor`.
	 */
	const tintIndex =
		stages === undefined
			? -1
			: stages.findIndex((stage) => stage.stageId === stageOf(task, stages));
	const tint =
		stages === undefined || tintIndex <= 0
			? null
			: stageColor(stages, tintIndex);

	/**
	 * Ticking it: on to the next stage while there is one before done, so a
	 * task goes through every stage its checklist has. Unticking takes it back
	 * one, to the stage before done; see `updateTask`.
	 */
	const check = (isDone: boolean) => {
		if (isDone && nextStage !== null && actions.onSetStage !== undefined) {
			actions.onSetStage(nextStage.stageId);
		} else {
			actions.onToggle(isDone);
		}
	};

	const shortcuts = useMemo(
		() => ({
			[TASK_SHORTCUTS.today]: () => {
				if (today !== null) actions.onSetSpecial("today", !isOnToday);
			},
			...(park === undefined ? {} : { [TASK_SHORTCUTS.backlog]: park.onMove }),
			[TASK_SHORTCUTS.urgent]: () => actions.onSetUrgent(!task.urgent),
			[TASK_SHORTCUTS.important]: () => actions.onSetImportant(!task.important),
			[TASK_SHORTCUTS.complete]: () => {
				if (!isTracked) check(!task.completed);
			},
			[TASK_SHORTCUTS.edit]: actions.onRename,
			[TASK_SHORTCUTS.type]: actions.onSetType,
			[TASK_SHORTCUTS.tag]: actions.onAddTag,
			// Only in a team, where there is somebody to assign it to.
			...(actions.onToggleMine === undefined
				? {}
				: { [TASK_SHORTCUTS.assign]: actions.onToggleMine }),
		}),
		[
			actions,
			today,
			isOnToday,
			park,
			task.urgent,
			task.important,
			task.completed,
			isTracked,
			check,
		],
	);

	useRowShortcuts(isHovered && canUpdateTasks, shortcuts);

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
	const tick = (isOn: boolean) =>
		isOn ? <Icon icon={Check} size="sm" color="accent" /> : undefined;

	/** The menu's People: in a team, taking it on or handing it to people. */
	const people = [
		...(actions.onToggleMine === undefined
			? []
			: [
					{
						label: isMine ? "Unassign me" : "Assign to me",
						icon: isMine ? UserMinus : UserCheck,
						endContent: <ShortcutKey label="Space" />,
						onClick: actions.onToggleMine,
					},
				]),
		...(actions.onAssign === undefined
			? []
			: [
					{
						label: "Assign people…",
						icon: Users,
						onClick: actions.onAssign,
					},
				]),
	];

	/** The menu's Organise: where it lives, and parking it in the Backlog. */
	const organise = [
		// Where it lives, and whether it exists, are a project manager's to
		// change; see `Capability`.
		...(actions.onMove === undefined || !canManageContent
			? []
			: [
					{
						label: "Move to checklist…",
						icon: FolderInput,
						onClick: actions.onMove,
					},
				]),
		...(park === undefined ? [] : [backlogMenuItem(park.title, park.onMove)]),
	];

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
			{canUpdateTasks ? (
				<div className="order-2 flex shrink-0 items-center gap-0.5 md:order-none">
					<TaskFlagButtons
						title={task.title}
						urgent={task.urgent}
						important={task.important}
						actions={actions}
					/>
				</div>
			) : null}

			<div className="order-1 flex min-w-0 flex-1 basis-full items-center gap-2 md:order-none md:basis-0">
				{/* The label is hidden but still the accessible name; the visible
				    title is drawn beside it so its tags keep their place. */}
				{/*
				 * A task following a tracker is ticked by the tracker, not by hand.
				 * The box still shows the state — it is the honest answer to "is
				 * this done" — but it cannot be the thing that changes it.
				 */}
				{/* In its stage's colour; see `.thunderlist-stage-check`. */}
				<span
					className="thunderlist-stage-check"
					data-tinted={tint !== null}
					style={tint === null ? undefined : stageColorStyle(tint)}
				>
					<CheckboxInput
						label={task.title}
						isLabelHidden
						value={task.completed}
						isDisabled={isTracked || !canUpdateTasks}
						disabledMessage={
							!canUpdateTasks
								? "You can see this team's work but not change it."
								: task.linkedChecklistId != null
									? "Finishes when its checklist does."
									: isTracked
										? "Finishes when its tracker does."
										: undefined
						}
						onChange={check}
					/>
				</span>
				{crumb === null && !task.caption && type === null ? (
					title
				) : (
					<VStack gap={0}>
						{title}
						{task.caption ? (
							<Text type="supporting">{task.caption}</Text>
						) : null}
						{crumb === null && type === null ? null : (
							<HStack gap={1} vAlign="center" wrap="wrap">
								{type === null ? null : (
									<span
										className="thunderlist-tag thunderlist-type"
										data-color={type.color}
									>
										{type.name}
									</span>
								)}
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
								{shownStage === null || crumb === null ? null : (
									<Text type="supporting">· {shownStage.name}</Text>
								)}
							</HStack>
						)}
					</VStack>
				)}
			</div>

			<div className="order-3 ml-auto flex shrink-0 items-center gap-0.5 md:order-none md:ml-0">
				<Assignees emails={task.assignees ?? []} />

				{today === null || !canUpdateTasks ? null : (
					<TodayButton
						title={task.title}
						today={today}
						isOn={isOnToday}
						onToggle={shortcuts[TASK_SHORTCUTS.today]}
					/>
				)}

				{canUpdateTasks ? (
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
						/*
						 * Grouped by what each entry is about, most used first: the
						 * task itself, the stage it is at, who has it, and where it
						 * lives. Deleting stands apart at the bottom, where it is not
						 * pressed by accident. A group with nothing in it for this
						 * task, or this role, is left out whole.
						 */
						items={[
							// Editing first: it is the reason this menu gets opened.
							{
								type: "section" as const,
								id: "details",
								title: "Details",
								items: [
									{
										label: "Edit",
										icon: Pencil,
										endContent: <ShortcutKey label={TASK_SHORTCUTS.edit} />,
										onClick: actions.onRename,
									},
									{
										label: "Type",
										icon: Shapes,
										endContent: (
											<ShortcutKey label={TASK_SHORTCUTS.type.toUpperCase()} />
										),
										onClick: actions.onSetType,
									},
									{
										label: "Tag",
										icon: TagIcon,
										endContent: <ShortcutKey label={TASK_SHORTCUTS.tag} />,
										onClick: actions.onAddTag,
									},
								],
							},
							...(movable === null || actions.onSetStage === undefined
								? []
								: [
										{
											type: "section" as const,
											id: "stage",
											title: "Stage",
											items: reachable.map((stage) => {
												const index = movable.indexOf(stage);
												return {
													id: stage.stageId,
													label: stage.name,
													icon: (
														<StageDot
															color={
																index === 0 ? null : stageColor(movable, index)
															}
														/>
													),
													endContent: tick(stage.stageId === stageId),
													onClick: () => actions.onSetStage?.(stage.stageId),
												};
											}),
										},
									]),
							...(people.length === 0
								? []
								: [
										{
											type: "section" as const,
											id: "people",
											title: "People",
											items: people,
										},
									]),
							...(organise.length === 0
								? []
								: [
										{
											type: "section" as const,
											id: "organise",
											title: "Organise",
											items: organise,
										},
									]),
							...(canManageContent
								? [
										{ type: "divider" as const },
										{
											label: "Delete task",
											icon: Trash2,
											variant: "destructive" as const,
											onClick: actions.onDelete,
										},
									]
								: []),
						]}
					/>
				) : null}
			</div>
		</div>
	);
}
