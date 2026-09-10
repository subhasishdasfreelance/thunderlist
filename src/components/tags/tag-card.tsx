import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { PaceLabel } from "#/components/common/pace-label";
import { ProgressMeter } from "#/components/common/progress-meter";
import { velocitySummary } from "#/components/common/velocity-stats";
import { computeVelocity, elapsedFraction } from "#/lib/progress";
import { type TagSummary, tagStartDate } from "#/schemas/tag";

/**
 * A tag at a glance, the way a checklist card shows a checklist: its share of
 * tasks done, its pace, and a bar carrying the point it should have reached by
 * now. The name is drawn as the tag itself, in its own colour.
 */
export function TagCard({ tag }: { tag: TagSummary }) {
	const { progress } = tag;
	const startDate = tagStartDate(tag);

	const elapsed = elapsedFraction({ startDate, deadline: tag.deadline });

	const summary =
		progress.total === 0
			? null
			: velocitySummary(
					computeVelocity({
						startDate,
						deadline: tag.deadline,
						current: progress.completed,
						target: progress.total,
					}),
					"tasks",
					progress.completed >= progress.total,
				);

	return (
		<ClickableCard
			label={`${tag.name}, ${progress.percent}% complete`}
			href={`/tags/${tag.tagId}`}
			padding={3}
		>
			<VStack gap={2}>
				<HStack gap={2} hAlign="between" vAlign="center">
					<HStack gap={1.5} vAlign="center">
						<Token size="sm" color={tag.color} label={tag.name} />
						<Text color="secondary">({progress.percent}%)</Text>
					</HStack>
					<PaceLabel status={tag.status} />
				</HStack>

				<ProgressMeter
					label={`${tag.name} progress`}
					percent={progress.percent}
					expectedPercent={elapsed === null ? null : elapsed * 100}
					footnote={`${progress.completed} / ${progress.total} ${
						progress.total === 1 ? "task" : "tasks"
					}`}
				/>

				{summary === null ? null : <Text type="supporting">{summary}</Text>}
			</VStack>
		</ClickableCard>
	);
}
