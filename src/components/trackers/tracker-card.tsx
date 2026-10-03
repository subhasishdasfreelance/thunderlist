import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { CardLastLine } from "#/components/common/card-last-line";
import { FadeImage } from "#/components/common/fade-image";
import { PaceLabel } from "#/components/common/pace-label";
import {
	PriorityMarks,
	priorityWords,
} from "#/components/common/priority-marks";
import { ProgressMeter } from "#/components/common/progress-meter";
import { velocitySummary } from "#/components/common/velocity-stats";
import { TaskFlagButtons } from "#/components/tasks/task-actions";
import { Assignees } from "#/components/teams/assignees";
import { useApplyChange } from "#/lib/changes";
import { computeVelocity, trackerFraction } from "#/lib/progress";
import { usePace } from "#/lib/use-pace";
import { useItemPermissions } from "#/lib/use-team";
import { type Tag, tagsFor } from "#/schemas/tag";
import type { TrackerSummary } from "#/schemas/tracker";

/**
 * Format progress in the tracker's own unit: "284 / 412 pages",
 * "12 / 20 lessons", "64 / 100 km". Nothing here is book-specific.
 */
export function formatProgress(
	current: number,
	target: number,
	unit: string,
): string {
	return `${current} / ${target} ${unit}`.trim();
}

/**
 * Where the reading should be by now, in the tracker's own unit: "13 videos".
 *
 * Measured across the same distance as the percentage, so a book opened at page
 * 40 and due to reach page 80 should be on page 60 halfway through the window.
 * One decimal place, as with speeds: "2.5 km" matters, "2.4871 km" does not.
 */
export function formatExpectedReading(
	elapsed: number,
	start: number,
	target: number,
	unit: string,
): string {
	const reading = start + elapsed * (target - start);
	return `${Math.round(reading * 10) / 10} ${unit}`.trim();
}

/**
 * A tracker at a glance. Its urgent and important flags are pressed to turn
 * them on and off, and move to the last line on a phone, as on a checklist's
 * card; see `ChecklistCard`.
 */
export function TrackerCard({
	tracker,
	tags,
	groupId,
}: {
	tracker: TrackerSummary;
	/** Every tag that exists, for drawing the ones this tracker carries. */
	tags: ReadonlyArray<Tag>;
	/** The group it is shown in, so its screen leads back there. */
	groupId?: string;
}) {
	const { progress } = tracker;
	const carried = tagsFor(tracker.tagIds ?? [], tags);
	const { apply } = useApplyChange();
	const { canManageContent } = useItemPermissions(tracker.access);

	function setFlag(patch: { urgent: boolean } | { important: boolean }) {
		apply({ kind: "tracker.update", trackerId: tracker.trackerId, patch });
	}

	const pace = usePace(
		tracker,
		progress.target > 0
			? trackerFraction(progress.current, progress.target, tracker.startValue)
			: null,
	);

	const summary =
		pace.now === null
			? null
			: velocitySummary(
					computeVelocity({
						startDate: tracker.startDate,
						deadline: tracker.deadline,
						deadlineTime: tracker.deadlineTime,
						current: progress.current,
						target: progress.target,
						start: tracker.startValue,
						now: pace.now,
					}),
					tracker.unit,
					progress.current >= progress.target && progress.target > 0,
					// A tracker is a goal with a date on it, so the line says when it is
					// due and what that now asks for a day.
					tracker.deadline,
				);

	const flags = canManageContent ? (
		<TaskFlagButtons
			title={tracker.title}
			urgent={tracker.urgent ?? false}
			important={tracker.important ?? false}
			hasShortcuts={false}
			actions={{
				onSetUrgent: (urgent) => setFlag({ urgent }),
				onSetImportant: (important) => setFlag({ important }),
			}}
		/>
	) : null;

	return (
		<ClickableCard
			label={`${tracker.title}, ${progress.percent}% complete${priorityWords(tracker)}`}
			href={`/trackers/${tracker.trackerId}${groupId === undefined ? "" : `?group=${groupId}`}`}
			padding={3}
		>
			<HStack gap={3} vAlign="center">
				{tracker.coverUrl ? (
					<FadeImage
						src={tracker.coverUrl}
						alt=""
						className="h-16 w-12 shrink-0 rounded-sm border border-border object-cover"
					/>
				) : null}

				<VStack gap={2} width="100%">
					<HStack gap={2} hAlign="between" vAlign="center">
						<HStack
							gap={1.5}
							vAlign="center"
							className="thunderlist-card-title"
						>
							{flags === null ? null : (
								<div className="thunderlist-row-buttons hidden shrink-0 items-center md:flex">
									{flags}
								</div>
							)}
							<Text weight="medium" maxLines={1}>
								{tracker.title}{" "}
								<Text color="secondary" weight="normal">
									({progress.percent}%)
								</Text>
							</Text>
						</HStack>
						<HStack gap={2} vAlign="center">
							{canManageContent ? null : <PriorityMarks {...tracker} />}
							<Assignees emails={tracker.assignees ?? []} />
							<PaceLabel status={pace.status} />
						</HStack>
					</HStack>

					{carried.length === 0 ? null : (
						<HStack gap={1} wrap="wrap">
							{carried.map((tag) => (
								<Token
									key={tag.tagId}
									size="sm"
									color={tag.color}
									label={tag.name}
								/>
							))}
						</HStack>
					)}

					<ProgressMeter
						label={`${tracker.title} progress`}
						percent={progress.percent}
						elapsed={pace.elapsed}
						expectedReading={
							pace.elapsed == null
								? undefined
								: formatExpectedReading(
										pace.elapsed,
										tracker.startValue,
										progress.target,
										tracker.unit,
									)
						}
						footnote={formatProgress(
							progress.current,
							progress.target,
							tracker.unit,
						)}
					/>

					<CardLastLine summary={summary} flags={flags} />
				</VStack>
			</HStack>
		</ClickableCard>
	);
}
