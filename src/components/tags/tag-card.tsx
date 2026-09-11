import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { PaceLabel } from "#/components/common/pace-label";
import {
	formatExpectedTasks,
	ProgressMeter,
} from "#/components/common/progress-meter";
import { velocitySummary } from "#/components/common/velocity-stats";
import { computeVelocity } from "#/lib/progress";
import { usePace } from "#/lib/use-pace";
import { type TagSummary, tagParam, tagStartDate } from "#/schemas/tag";
import { SPECIAL_TAG_ICONS } from "./special-tag-icons";

/**
 * A tag at a glance, the way a checklist card shows a checklist: its share of
 * tasks done, its pace, and a bar carrying the point it should have reached by
 * now. The name is drawn as the tag itself, in its own colour.
 */
export function TagCard({ tag }: { tag: TagSummary }) {
	const { progress } = tag;
	const startDate = tagStartDate(tag);

	const pace = usePace(
		{ ...tag, startDate },
		progress.total === 0 ? null : progress.completed / progress.total,
	);

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

	// Today and the Backlog carry their marks, so they read as the two they are.
	const Mark = tag.special === null ? null : SPECIAL_TAG_ICONS[tag.special];

	return (
		<ClickableCard
			label={`${tag.name}, ${progress.percent}% complete`}
			href={`/tags/${tagParam(tag)}`}
			padding={3}
		>
			<VStack gap={2}>
				<HStack gap={2} hAlign="between" vAlign="center">
					<HStack gap={1.5} vAlign="center">
						<Token
							size="sm"
							color={tag.color}
							label={tag.name}
							icon={Mark === null ? undefined : <Mark aria-hidden />}
						/>
						<Text color="secondary">({progress.percent}%)</Text>
					</HStack>
					<PaceLabel status={pace.status} />
				</HStack>

				<ProgressMeter
					label={`${tag.name} progress`}
					percent={progress.percent}
					elapsed={pace.elapsed}
					expectedReading={
						pace.elapsed == null
							? undefined
							: formatExpectedTasks(pace.elapsed, progress.total)
					}
					footnote={`${progress.completed} / ${progress.total} ${
						progress.total === 1 ? "task" : "tasks"
					}`}
				/>

				{summary === null ? null : <Text type="supporting">{summary}</Text>}
			</VStack>
		</ClickableCard>
	);
}
