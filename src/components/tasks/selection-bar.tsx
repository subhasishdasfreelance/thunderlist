import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Text } from "@astryxdesign/core/Text";
import {
	ArrowRight,
	Check,
	FolderInput,
	Pencil,
	Tag as TagIcon,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { StageDot } from "#/components/common/stage-dot";
import { usePickKeys } from "#/lib/use-pick-keys";
import { type Stage, stageColor } from "#/schemas/checklist";
import { TASK_SHORTCUTS } from "./task-actions";

/**
 * What can be done at once to the tasks a text selection picked out; see
 * `useTaskSelection`.
 *
 * Copying a few tasks to paste somewhere is usually the moment they move on —
 * into review, say — so the bar offers that: each on to its own next stage,
 * or, on a checklist, all to one stage of its. A tag gathers tasks from
 * checklists with different stages, so there it offers done instead.
 *
 * Moving them all into another checklist is offered beside those, since a
 * handful of rows picked out is exactly what a move usually is: sorting a
 * dozen tasks into the lists they belong in, one pick rather than one menu
 * each. Tagging them is offered for the same reason, and is the other half of
 * that sort: what a dozen tasks have in common is usually one word. Deleting
 * them comes last, apart, asked about first by the page.
 *
 * It floats at the foot of the screen, over the page, for as long as anything
 * is picked, so the rows picked can be far down a list and the bar still in
 * reach; on a phone it sits above the bottom bar.
 *
 * Every key a row answers to does for the pick what it does for one row — the
 * tick key each on to its next stage, or done where none has one; T, U and I
 * on for all of them, or off where all have it — and is saved as one change
 * for them all; see `applyBatched`. With the rows picked from the keyboard
 * (see `useTaskSelection`), a run of tasks is dealt with without the pointer.
 * E and Enter edit what they can share, all at once; see `TasksEditDialog`.
 *
 * The keys with no button of their own here are the row's quick ones, there
 * for whoever is already at the keyboard; on a phone the bar is as it was.
 */
export function SelectionBar({
	count,
	onNextStage,
	stages,
	onMoveTo,
	onDone,
	onEdit,
	onMoveToChecklist,
	onAddTag,
	onDelete,
	onToggleToday,
	onBacklog,
	onToggleUrgent,
	onToggleImportant,
	onSetType,
	onToggleMine,
	onAssign,
	onClear,
}: {
	count: number;
	/** Each on to its next stage. Left out when none of them has one. */
	onNextStage?: () => void;
	/** The stages all of them share — a checklist's — to move them to. */
	stages?: ReadonlyArray<Stage>;
	onMoveTo?: (stageId: string) => void;
	/** Finish them. Left out when none of them can be finished by hand. */
	onDone?: () => void;
	/** Edit them, together; see `TasksEditDialog`. */
	onEdit: () => void;
	/**
	 * Move all of them into another checklist, picked in a dialog. Left out
	 * for anyone whose role may not move tasks; see `Capability`.
	 */
	onMoveToChecklist?: () => void;
	/**
	 * Put a tag on all of them, or take it off all of them where every one has
	 * it — picked in a dialog; see `TagTasks`.
	 */
	onAddTag?: () => void;
	/**
	 * Delete all of them, once the page has asked. Left out for anyone whose
	 * role may not delete tasks; see `Capability`.
	 */
	onDelete?: () => void;
	/** Today on for all of them, or off. Left out until the tags are known. */
	onToggleToday?: () => void;
	/** Park them all in the Backlog. Left out where there is none to go to. */
	onBacklog?: () => void;
	onToggleUrgent: () => void;
	onToggleImportant: () => void;
	/** Say what kind of work all of them are, picked in a dialog. */
	onSetType: () => void;
	/** Take them all on, or give them all back. Left out outside a team. */
	onToggleMine?: () => void;
	/** Give them all to people, picked in a dialog. Left out outside a team. */
	onAssign?: () => void;
	onClear: () => void;
}) {
	const keys: Record<string, (() => void) | undefined> = {
		[TASK_SHORTCUTS.complete]: onNextStage ?? onDone,
		[TASK_SHORTCUTS.edit]: onEdit,
		// Opening what is picked, as Enter does anywhere.
		enter: onEdit,
		[TASK_SHORTCUTS.today]: onToggleToday,
		[TASK_SHORTCUTS.backlog]: onBacklog,
		[TASK_SHORTCUTS.move]: onMoveToChecklist,
		[TASK_SHORTCUTS.urgent]: onToggleUrgent,
		[TASK_SHORTCUTS.important]: onToggleImportant,
		[TASK_SHORTCUTS.type]: onSetType,
		[TASK_SHORTCUTS.tag]: onAddTag,
		[TASK_SHORTCUTS.assign]: onToggleMine,
		[TASK_SHORTCUTS.delete]: onDelete,
	};

	usePickKeys(keys);

	return (
		<div
			role="toolbar"
			aria-label={`${count} ${count === 1 ? "task" : "tasks"} selected`}
			className="thunderlist-selection-bar"
		>
			<Text weight="medium">{count} selected</Text>

			{onNextStage === undefined ? null : (
				<Button
					label="Next stage"
					tooltip={`Next stage (${TASK_SHORTCUTS.complete.toUpperCase()})`}
					variant="secondary"
					size="sm"
					icon={<ArrowRight aria-hidden />}
					onClick={onNextStage}
				/>
			)}

			{stages === undefined || onMoveTo === undefined ? null : (
				<DropdownMenu
					placement="above"
					alignment="start"
					button={{ label: "Move to", variant: "secondary", size: "sm" }}
					items={stages.map((stage, index) => ({
						id: stage.stageId,
						label: stage.name,
						icon: (
							<StageDot
								color={index === 0 ? null : stageColor(stages, index)}
							/>
						),
						onClick: () => onMoveTo(stage.stageId),
					}))}
				/>
			)}

			{onDone === undefined ? null : (
				<Button
					label="Done"
					tooltip={
						onNextStage === undefined
							? `Done (${TASK_SHORTCUTS.complete.toUpperCase()})`
							: undefined
					}
					variant="secondary"
					size="sm"
					icon={<Check aria-hidden />}
					onClick={onDone}
				/>
			)}

			<Button
				label="Edit"
				tooltip={`Edit (${TASK_SHORTCUTS.edit.toUpperCase()})`}
				variant="secondary"
				size="sm"
				icon={<Pencil aria-hidden />}
				onClick={onEdit}
			/>

			{onAddTag === undefined ? null : (
				<Button
					label="Tag"
					variant="secondary"
					size="sm"
					icon={<TagIcon aria-hidden />}
					onClick={onAddTag}
				/>
			)}

			{onAssign === undefined ? null : (
				<Button
					label="Assign"
					variant="secondary"
					size="sm"
					icon={<Users aria-hidden />}
					onClick={onAssign}
				/>
			)}

			{onMoveToChecklist === undefined ? null : (
				<Button
					label="Move to checklist"
					variant="secondary"
					size="sm"
					icon={<FolderInput aria-hidden />}
					onClick={onMoveToChecklist}
				/>
			)}

			{onDelete === undefined ? null : (
				<Button
					label="Delete"
					variant="destructive"
					size="sm"
					icon={<Trash2 aria-hidden />}
					onClick={onDelete}
				/>
			)}

			<IconButton
				label="Clear selection"
				tooltip="Clear (Esc)"
				variant="ghost"
				size="sm"
				icon={<X aria-hidden />}
				onClick={onClear}
			/>
		</div>
	);
}
