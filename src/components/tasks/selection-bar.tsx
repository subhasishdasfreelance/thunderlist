import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Text } from "@astryxdesign/core/Text";
import {
	ArrowRight,
	Check,
	FolderInput,
	Tag as TagIcon,
	X,
} from "lucide-react";
import { StageDot } from "#/components/common/stage-dot";
import { type Stage, stageColor } from "#/schemas/checklist";

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
 * that sort: what a dozen tasks have in common is usually one word.
 *
 * It floats at the foot of the screen, over the page, for as long as anything
 * is picked, so the rows picked can be far down a list and the bar still in
 * reach; on a phone it sits above the bottom bar.
 */
export function SelectionBar({
	count,
	onNextStage,
	stages,
	onMoveTo,
	onDone,
	onMoveToChecklist,
	onAddTag,
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
	onClear: () => void;
}) {
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
