import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ArrowDown, ArrowUp, Check, Plus, X } from "lucide-react";
import { type Dispatch, memo, type SetStateAction, useCallback } from "react";
import { StageDot } from "#/components/common/stage-dot";
import { COLOR_OPTIONS } from "#/components/tags/tag-form-dialog";
import { createId, ID_PREFIX } from "#/lib/ids";
import { type Stage, stageColor, unusedStageColor } from "#/schemas/checklist";
import type { TagColor } from "#/schemas/tag";

/** As many as `stagesSchema` allows. */
const MAX_STAGES = 12;

/**
 * What is wrong with a set of stages, or `null` when it can be saved: every
 * stage named, and no two named alike. The rest — at least two — the controls
 * below never let happen.
 */
export function stagesProblem(stages: ReadonlyArray<Stage>): string | null {
	if (stages.some((stage) => stage.name.trim() === "")) {
		return "Every stage needs a name.";
	}

	const names = stages.map((stage) => stage.name.trim().toLowerCase());
	if (new Set(names).size !== names.length) {
		return "Two stages can't share a name.";
	}

	return null;
}

/**
 * The steps a checklist's tasks go through, in order: "To do", "Review",
 * "UAT", "Done".
 *
 * The last is done — a task reaching it is complete, as ticking it is — so a
 * new stage goes in before it, where work in progress belongs. Each can be
 * renamed and moved; renaming keeps the tasks at it, and taking one away moves
 * its tasks back to the stage before it.
 *
 * Each but the first has a colour: its part of the progress bar, and the
 * outline of its tasks' checkboxes. The first is the work not started — the
 * bar's empty track — so it has none to pick. A new stage takes a colour no
 * other stage has.
 *
 * Memoised, and so is each row: typing a stage's name draws that row again
 * and no other, and typing anywhere else in the form draws none of them.
 * `onChange` is a state setter so the rows' handlers can work from the latest
 * stages and keep their identity while names change.
 */
export const StagesField = memo(function StagesField({
	value,
	onChange,
}: {
	value: ReadonlyArray<Stage>;
	onChange: Dispatch<SetStateAction<Array<Stage>>>;
}) {
	const problem = stagesProblem(value);

	const rename = useCallback(
		(index: number, name: string) =>
			onChange((stages) =>
				stages.map((stage, at) => (at === index ? { ...stage, name } : stage)),
			),
		[onChange],
	);

	const recolor = useCallback(
		(index: number, color: TagColor) =>
			onChange((stages) =>
				stages.map((stage, at) => (at === index ? { ...stage, color } : stage)),
			),
		[onChange],
	);

	const move = useCallback(
		(index: number, by: -1 | 1) =>
			onChange((stages) => {
				const next = [...stages];
				const [stage] = next.splice(index, 1);
				next.splice(index + by, 0, stage);
				return next;
			}),
		[onChange],
	);

	const remove = useCallback(
		(index: number) =>
			onChange((stages) => stages.filter((_, at) => at !== index)),
		[onChange],
	);

	function add() {
		onChange((stages) => [
			...stages.slice(0, -1),
			{
				stageId: createId(ID_PREFIX.stage),
				name: "",
				color: unusedStageColor(stages),
			},
			...stages.slice(-1),
		]);
	}

	return (
		<VStack gap={2}>
			<VStack gap={0.5}>
				<Text type="label" weight="semibold">
					Stages
				</Text>
				<Text type="supporting">
					Tasks move through these in order. Reaching the last one is done. Each
					colour is that stage's part of the progress bar.
				</Text>
			</VStack>

			{/*
			 * A checklist may have a dozen stages, so the rows scroll and the
			 * button that adds one stays where it was.
			 */}
			<VStack gap={1} className="thunderlist-picker-list">
				{value.map((stage, index) => (
					<StageRow
						key={stage.stageId}
						stage={stage}
						index={index}
						color={stageColor(value, index)}
						isLast={index === value.length - 1}
						canRemove={value.length > 2}
						onRename={rename}
						onRecolor={recolor}
						onMove={move}
						onRemove={remove}
					/>
				))}
			</VStack>

			<HStack gap={2} hAlign="between" vAlign="center">
				<Button
					label="Add a stage"
					icon={<Plus aria-hidden />}
					variant="ghost"
					size="sm"
					isDisabled={value.length >= MAX_STAGES}
					onClick={add}
				/>
				{problem === null ? null : <Text type="supporting">{problem}</Text>}
			</HStack>
		</VStack>
	);
});

/** One stage: its colour, its name, and the buttons that move or remove it. */
const StageRow = memo(function StageRow({
	stage,
	index,
	color,
	isLast,
	canRemove,
	onRename,
	onRecolor,
	onMove,
	onRemove,
}: {
	stage: Stage;
	index: number;
	color: TagColor;
	isLast: boolean;
	canRemove: boolean;
	onRename: (index: number, name: string) => void;
	onRecolor: (index: number, color: TagColor) => void;
	onMove: (index: number, by: -1 | 1) => void;
	onRemove: (index: number) => void;
}) {
	const name = stage.name || "this stage";

	return (
		// Wraps, so on a narrow phone the name takes a line of its own rather
		// than being squeezed between the colour and the three buttons.
		<div className="flex flex-wrap items-center gap-1">
			{index === 0 ? (
				<span
					className="thunderlist-stage-swatch"
					title="Not started: the empty part of the bar"
				>
					<StageDot color={null} />
				</span>
			) : (
				<DropdownMenu
					hasChevron={false}
					placement="below"
					alignment="start"
					button={{
						label: `Colour of ${name}`,
						tooltip: "Colour",
						variant: "ghost",
						size: "sm",
						isIconOnly: true,
						icon: <StageDot color={color} />,
					}}
					items={COLOR_OPTIONS.map((option) => ({
						id: option.value,
						label: option.label,
						icon: <StageDot color={option.value} />,
						endContent:
							option.value === color ? (
								<Check aria-hidden size={16} />
							) : undefined,
						onClick: () => onRecolor(index, option.value),
					}))}
				/>
			)}
			<span className="min-w-40 flex-1">
				<TextInput
					label={isLast ? `Stage ${index + 1}, done` : `Stage ${index + 1}`}
					isLabelHidden
					value={stage.name}
					onChange={(next) => onRename(index, next)}
					placeholder={isLast ? "Done" : index === 0 ? "To do" : "In review"}
					width="100%"
				/>
			</span>
			<IconButton
				label={`Move ${name} earlier`}
				icon={<ArrowUp aria-hidden />}
				variant="ghost"
				size="sm"
				isDisabled={index === 0}
				onClick={() => onMove(index, -1)}
			/>
			<IconButton
				label={`Move ${name} later`}
				icon={<ArrowDown aria-hidden />}
				variant="ghost"
				size="sm"
				isDisabled={isLast}
				onClick={() => onMove(index, 1)}
			/>
			<IconButton
				label={`Remove ${name}`}
				icon={<X aria-hidden />}
				variant="ghost"
				size="sm"
				isDisabled={!canRemove}
				onClick={() => onRemove(index)}
			/>
		</div>
	);
});
