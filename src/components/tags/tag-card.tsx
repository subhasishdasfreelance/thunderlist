import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { PaceLabel } from "#/components/common/pace-label";
import {
	PriorityMarks,
	priorityWords,
} from "#/components/common/priority-marks";
import {
	formatExpectedTasks,
	ProgressMeter,
} from "#/components/common/progress-meter";
import { velocitySummary } from "#/components/common/velocity-stats";
import { FocusButton } from "#/components/tasks/task-actions";
import { useApplyChange } from "#/lib/changes";
import { formatSchedule } from "#/lib/format-date";
import { computeVelocity } from "#/lib/progress";
import { usePace } from "#/lib/use-pace";
import { useItemPermissions } from "#/lib/use-team";
import {
	type TagSummary,
	tagParam,
	tagStageParts,
	tagStartDate,
} from "#/schemas/tag";
import { SPECIAL_TAG_ICONS } from "./special-tag-icons";

/**
 * A tag at a glance, the way a checklist card shows a checklist: its share of
 * tasks done, its pace, and a bar carrying the point it should have reached by
 * now. The name is drawn as the tag itself, in its own colour.
 *
 * Its focus button marks it as current focus, as a checklist's card does;
 * not on Current focus itself, which would only be listing itself.
 */
export function TagCard({ tag }: { tag: TagSummary }) {
	const { progress } = tag;
	const startDate = tagStartDate(tag);
	const { apply } = useApplyChange();
	const { canManageContent } = useItemPermissions(tag.access);
	const canFocus = canManageContent && tag.special !== "focus";

	const pace = usePace(
		{ ...tag, startDate },
		progress.total === 0 ? null : progress.completed / progress.total,
	);

	const summary =
		progress.total === 0 || pace.now === null
			? null
			: velocitySummary(
					computeVelocity({
						startDate,
						deadline: tag.deadline,
						deadlineTime: tag.deadlineTime,
						current: progress.completed,
						target: progress.total,
						now: pace.now,
					}),
					"tasks",
					progress.completed >= progress.total,
				);

	// Today and Current focus carry their marks, so they read as what they are.
	const Mark = tag.special === null ? null : SPECIAL_TAG_ICONS[tag.special];

	return (
		<ClickableCard
			label={`${tag.name}, ${progress.percent}% complete${priorityWords(tag)}`}
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
							icon={Mark === null ? undefined : <Icon icon={Mark} size="xsm" />}
						/>
						<Text color="secondary">({progress.percent}%)</Text>
						<PriorityMarks
							urgent={tag.urgent}
							important={tag.important}
							focused={canFocus ? false : tag.focused}
						/>
						{canFocus ? (
							<div className="thunderlist-row-buttons flex shrink-0 items-center">
								<FocusButton
									title={tag.name}
									isOn={tag.focused ?? false}
									onToggle={(focused) =>
										apply({
											kind: "tag.update",
											tagId: tag.tagId,
											patch: { focused },
										})
									}
								/>
							</div>
						) : null}
					</HStack>
					<PaceLabel status={pace.status} />
				</HStack>

				<ProgressMeter
					label={`${tag.name} progress`}
					percent={progress.percent}
					stages={{
						parts: tagStageParts(progress, tag.stageColors),
						total: progress.total,
						firstName: "To do",
					}}
					elapsed={pace.elapsed}
					expectedReading={
						pace.elapsed == null
							? undefined
							: formatExpectedTasks(pace.elapsed, progress.total)
					}
					footnote={formatSchedule(tag)}
				/>

				{summary === null ? null : <Text type="supporting">{summary}</Text>}
			</VStack>
		</ClickableCard>
	);
}
