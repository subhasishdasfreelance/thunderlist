import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { createId, ID_PREFIX } from "#/lib/ids";
import type { Stage } from "#/schemas/checklist";

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
 */
export function StagesField({
	value,
	onChange,
}: {
	value: ReadonlyArray<Stage>;
	onChange: (stages: Array<Stage>) => void;
}) {
	const problem = stagesProblem(value);

	function rename(index: number, name: string) {
		onChange(
			value.map((stage, at) => (at === index ? { ...stage, name } : stage)),
		);
	}

	function move(index: number, by: -1 | 1) {
		const next = [...value];
		const [stage] = next.splice(index, 1);
		next.splice(index + by, 0, stage);
		onChange(next);
	}

	function remove(index: number) {
		onChange(value.filter((_, at) => at !== index));
	}

	function add() {
		onChange([
			...value.slice(0, -1),
			{ stageId: createId(ID_PREFIX.stage), name: "" },
			...value.slice(-1),
		]);
	}

	return (
		<VStack gap={2}>
			<VStack gap={0.5}>
				<Text type="label" weight="semibold">
					Stages
				</Text>
				<Text type="supporting">
					Tasks move through these in order. Reaching the last one is done.
				</Text>
			</VStack>

			{value.map((stage, index) => {
				const isLast = index === value.length - 1;

				return (
					<HStack key={stage.stageId} gap={1} vAlign="center">
						<TextInput
							label={isLast ? `Stage ${index + 1}, done` : `Stage ${index + 1}`}
							isLabelHidden
							value={stage.name}
							onChange={(name) => rename(index, name)}
							placeholder={
								isLast ? "Done" : index === 0 ? "To do" : "In review"
							}
							width="100%"
						/>
						<IconButton
							label={`Move ${stage.name || "this stage"} earlier`}
							icon={<ArrowUp aria-hidden />}
							variant="ghost"
							size="sm"
							isDisabled={index === 0}
							onClick={() => move(index, -1)}
						/>
						<IconButton
							label={`Move ${stage.name || "this stage"} later`}
							icon={<ArrowDown aria-hidden />}
							variant="ghost"
							size="sm"
							isDisabled={isLast}
							onClick={() => move(index, 1)}
						/>
						<IconButton
							label={`Remove ${stage.name || "this stage"}`}
							icon={<X aria-hidden />}
							variant="ghost"
							size="sm"
							isDisabled={value.length <= 2}
							onClick={() => remove(index)}
						/>
					</HStack>
				);
			})}

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
}
