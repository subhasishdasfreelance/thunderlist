import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Text } from "@astryxdesign/core/Text";
import { ArrowRight, Check, X } from "lucide-react";
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
