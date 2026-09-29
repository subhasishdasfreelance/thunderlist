import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Text } from "@astryxdesign/core/Text";
import {
	ArrowRight,
	Check,
	FolderInput,
	Tag as TagIcon,
	Trash2,
	X,
} from "lucide-react";
import { useEffect } from "react";
import { StageDot } from "#/components/common/stage-dot";
import { isTyping } from "#/lib/use-row-shortcuts";
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
 * The tick key does for the pick what it does for one row: each on to its next
 * stage, or done where none has one. With the rows picked from the keyboard
 * (see `useTaskSelection`), a run of tasks moves on without the pointer.
 */
export function SelectionBar({
	count,
	onNextStage,
	stages,
	onMoveTo,
	onDone,
	onMoveToChecklist,
	onAddTag,
	onDelete,
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
	onClear: () => void;
}) {
	const tick = onNextStage ?? onDone;

	useEffect(() => {
		if (tick === undefined) return;
		const run = tick;

		function handle(event: KeyboardEvent) {
			if (event.key.toLowerCase() !== TASK_SHORTCUTS.complete) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isTyping(event.target)) return;
			if (
				event.target instanceof Element &&
				event.target.closest('dialog, [role="dialog"]')
			) {
				return;
			}

			// Ahead of the row under the pointer, which would tick itself too.
			event.preventDefault();
			event.stopImmediatePropagation();
			run();
		}

		window.addEventListener("keydown", handle, true);
		return () => window.removeEventListener("keydown", handle, true);
	}, [tick]);

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

			{onAddTag === undefined ? null : (
				<Button
					label="Tag"
					variant="secondary"
					size="sm"
					icon={<TagIcon aria-hidden />}
					onClick={onAddTag}
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
