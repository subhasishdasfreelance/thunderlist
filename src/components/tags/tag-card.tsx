import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { CardLastLine } from "#/components/common/card-last-line";
import { CoverImage } from "#/components/common/cover-image";
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
import { ItemFlagButtons } from "#/components/tasks/task-actions";
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
	tagStartTime,
} from "#/schemas/tag";
import { SPECIAL_TAG_ICONS } from "./special-tag-icons";

/**
 * A tag at a glance, the way a checklist card shows a checklist: its share of
 * tasks done, its pace, and a bar carrying the point it should have reached by
 * now. The name is drawn as the tag itself, in its own colour.
 *
 * Its flags are pressed to turn them on and off, as on a checklist's card;
 * see `ItemFlagButtons`.
 */
export function TagCard({ tag }: { tag: TagSummary }) {
	const { progress } = tag;
	const startDate = tagStartDate(tag);
	const startTime = tagStartTime(tag);
	const { apply } = useApplyChange();
	const { canManageContent } = useItemPermissions(tag.access);

	const pace = usePace(
		{ ...tag, startDate, startTime },
		progress.total === 0 ? null : progress.completed / progress.total,
	);

	const summary =
		progress.total === 0 || pace.now === null
			? null
			: velocitySummary(
					computeVelocity({
						startDate,
						startTime,
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

	const flags = canManageContent ? (
		<ItemFlagButtons
			title={tag.name}
			item={tag}
			special={tag.special}
			onSet={(patch) => apply({ kind: "tag.update", tagId: tag.tagId, patch })}
		/>
	) : null;

	return (
		<ClickableCard
			label={`${tag.name}, ${progress.percent}% complete${priorityWords(tag)}`}
			href={`/tags/${tagParam(tag)}`}
			padding={3}
		>
			<HStack gap={3} vAlign="center">
				<CoverImage images={tag.images} size="card" />
				<VStack gap={2} width="100%" className="min-w-0">
					<HStack gap={2} hAlign="between" vAlign="center">
						<HStack gap={1.5} vAlign="center" className="min-w-0 flex-1">
							{/* First, as on a checklist's card; see `ChecklistCard`. */}
							{flags === null ? null : (
								<div className="thunderlist-row-buttons hidden shrink-0 items-center md:flex">
									{flags}
								</div>
							)}
							<Token
								size="sm"
								color={tag.color}
								label={tag.name}
								icon={
									Mark === null ? undefined : <Icon icon={Mark} size="xsm" />
								}
							/>
							<Text color="secondary">({progress.percent}%)</Text>
							{canManageContent ? null : <PriorityMarks {...tag} />}
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

					<CardLastLine summary={summary} flags={flags} />
				</VStack>
			</HStack>
		</ClickableCard>
	);
}
