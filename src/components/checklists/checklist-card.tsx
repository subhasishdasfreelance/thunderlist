import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { PaceLabel } from "#/components/common/pace-label";
import {
	formatExpectedTasks,
	ProgressMeter,
} from "#/components/common/progress-meter";
import { velocitySummary } from "#/components/common/velocity-stats";
import { formatSchedule } from "#/lib/format-date";
import { computeVelocity } from "#/lib/progress";
import { usePace } from "#/lib/use-pace";
import {
	type ChecklistSummary,
	checklistStages,
	stageParts,
} from "#/schemas/checklist";
import { SPECIAL_CHECKLIST_ICONS } from "./special-checklist-icons";

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
		progress.total === 0 || pace.now === null
			? null
			: velocitySummary(
					computeVelocity({
						startDate: checklist.startDate,
						deadline: checklist.deadline,
						deadlineTime: checklist.deadlineTime,
						current: progress.completed,
						target: progress.total,
						now: pace.now,
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
					<HStack gap={1.5} vAlign="center">
						{/* The Inbox and the Backlog carry their marks, so they read as
						    the two they are. */}
						{checklist.special == null ? null : (
							<Icon
								icon={SPECIAL_CHECKLIST_ICONS[checklist.special]}
								size="sm"
								color="secondary"
							/>
						)}
						<Text weight="medium" maxLines={1}>
							{checklist.title}{" "}
							<Text color="secondary" weight="normal">
								({progress.percent}%)
							</Text>
						</Text>
					</HStack>
					<PaceLabel status={pace.status} />
				</HStack>

				<ProgressMeter
					label={`${checklist.title} progress`}
					percent={progress.percent}
					stages={{
						parts: stageParts(checklistStages(checklist), progress.byStage),
						total: progress.total,
						firstName: checklistStages(checklist)[0].name,
					}}
					elapsed={pace.elapsed}
					expectedReading={
						pace.elapsed == null
							? undefined
							: formatExpectedTasks(pace.elapsed, progress.total)
					}
					footnote={formatSchedule(checklist)}
				/>

				{summary === null ? null : <Text type="supporting">{summary}</Text>}
			</VStack>
		</ClickableCard>
	);
}
