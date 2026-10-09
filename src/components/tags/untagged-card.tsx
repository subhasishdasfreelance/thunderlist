import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { TagX } from "lucide-react";
import { useMemo } from "react";
import { ProgressMeter } from "#/components/common/progress-meter";
import type { SearchIndex } from "#/data/search.server";
import { calculateChecklistProgress } from "#/lib/tasks/tasks";
import type { TaggedTask } from "#/queries/system";
import { checklistStages, underwayStage } from "#/schemas/checklist";
import { countTagStages, tagStageParts } from "#/schemas/tag";

/**
 * The tasks carrying no tag, as a card among the tags, drawn as a tag's is: the
 * name as a chip, the share done, and the bar in parts by stage with its
 * legend underneath, opening onto a list of its own.
 *
 * It is not a tag, so its chip is grey, and there is no start date or deadline
 * to measure a pace against — the pace label, the expected mark and the speed
 * line are left off rather than invented.
 */
export function UntaggedCard({
	tasks,
	checklists,
}: {
	tasks: ReadonlyArray<TaggedTask>;
	checklists: SearchIndex["checklists"];
}) {
	// Counted as a tag's are on the server; see `summarise` in `tag.server.ts`.
	const progress = useMemo(() => {
		const byId = new Map(checklists.map((each) => [each.checklistId, each]));
		const stages = tasks.map((task) =>
			underwayStage(
				task,
				checklistStages(
					(task.checklistId === null
						? undefined
						: byId.get(task.checklistId)) ?? {},
				),
			),
		);
		return {
			...calculateChecklistProgress(tasks),
			stages: countTagStages(stages),
		};
	}, [tasks, checklists]);

	return (
		<ClickableCard
			label={`Untagged, ${progress.percent}% complete`}
			href="/tags/untagged"
			padding={3}
		>
			<VStack gap={2}>
				<HStack gap={1.5} vAlign="center">
					<Token
						size="sm"
						color="gray"
						label="Untagged"
						icon={<Icon icon={TagX} size="xsm" />}
					/>
					<Text color="secondary">({progress.percent}%)</Text>
				</HStack>

				<ProgressMeter
					label="Untagged progress"
					percent={progress.percent}
					stages={{
						parts: tagStageParts(progress),
						total: progress.total,
						firstName: "To do",
					}}
					elapsed={null}
				/>
			</VStack>
		</ClickableCard>
	);
}
