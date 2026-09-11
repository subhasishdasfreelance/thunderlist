import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { PaceLabel } from "#/components/common/pace-label";
import {
	formatExpectedTasks,
	ProgressMeter,
} from "#/components/common/progress-meter";
import { velocitySummary } from "#/components/common/velocity-stats";
import { computeVelocity } from "#/lib/progress";
import { usePace } from "#/lib/use-pace";
import type { ChecklistSummary } from "#/schemas/checklist";

/**
 * A checklist at a glance: title with its percentage, pace, and a bar carrying
 * the point the work should have reached by now.
 */
export function ChecklistCard({ checklist }: { checklist: ChecklistSummary }) {
	const { progress } = checklist;

	const pace = usePace(
		checklist,
		progress.total === 0 ? null : progress.completed / progress.total,
	);

	// Tasks are the unit here, so the same maths a tracker uses for pages
	// answers "how fast am I getting through this list".
	const summary =
		progress.total === 0
			? null
			: velocitySummary(
					computeVelocity({
						startDate: checklist.startDate,
						deadline: checklist.deadline,
						current: progress.completed,
						target: progress.total,
					}),
					"tasks",
					progress.completed >= progress.total,
				);

	return (
		<ClickableCard
			label={`${checklist.title}, ${progress.percent}% complete`}
			href={`/checklists/${checklist.checklistId}`}
			padding={3}
		>
			<VStack gap={2}>
				<HStack gap={2} hAlign="between" vAlign="center">
					<Text weight="medium" maxLines={1}>
						{checklist.title}{" "}
						<Text color="secondary" weight="normal">
							({progress.percent}%)
						</Text>
					</Text>
					<PaceLabel status={pace.status} />
				</HStack>

				<ProgressMeter
					label={`${checklist.title} progress`}
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
