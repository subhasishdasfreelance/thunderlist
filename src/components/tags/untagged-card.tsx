import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { ProgressMeter } from "#/components/common/progress-meter";
import { calculateChecklistProgress } from "#/lib/tasks/tasks";
import type { TaggedTask } from "#/queries/system";

/**
 * The tasks carrying no tag, as a card among the tags: the same share done and
 * the same bar, opening onto a list of its own.
 *
 * It is not a tag, so there is no colour to draw the name in, and no start date
 * or deadline to measure a pace against — the pace label, the expected mark and
 * the speed line are left off rather than invented.
 */
export function UntaggedCard({ tasks }: { tasks: ReadonlyArray<TaggedTask> }) {
	const progress = calculateChecklistProgress(tasks);

	return (
		<ClickableCard
			label={`Untagged, ${progress.percent}% complete`}
			href="/tags/untagged"
			padding={3}
		>
			<VStack gap={2}>
				<HStack gap={1.5} vAlign="center">
					<Text weight="medium">Untagged</Text>
					<Text color="secondary">({progress.percent}%)</Text>
				</HStack>

				<ProgressMeter
					label="Untagged progress"
					percent={progress.percent}
					elapsed={null}
					footnote={`${progress.completed} / ${progress.total} ${
						progress.total === 1 ? "task" : "tasks"
					}`}
				/>
			</VStack>
		</ClickableCard>
	);
}
