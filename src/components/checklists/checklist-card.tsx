import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { CardLastLine } from "#/components/common/card-last-line";
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
import { FocusButton, TaskFlagButtons } from "#/components/tasks/task-actions";
import { useApplyChange } from "#/lib/changes";
import { formatSchedule } from "#/lib/format-date";
import { computeVelocity } from "#/lib/progress";
import { usePace } from "#/lib/use-pace";
import { useItemPermissions } from "#/lib/use-team";
import {
	type ChecklistSummary,
	checklistStages,
	stageParts,
} from "#/schemas/checklist";
import { SPECIAL_CHECKLIST_ICONS } from "./special-checklist-icons";

/**
 * A checklist at a glance: title with its percentage, pace, and a bar carrying
 * the point the work should have reached by now.
 *
 * Its urgent and important flags are the buttons a task row has, pressed to
 * turn them on and off; to someone who may not change it, they are only marks.
 * On a phone they move to the last line, leaving the title its width, as a
 * task row's do.
 */
export function ChecklistCard({
	checklist,
	groupId,
}: {
	checklist: ChecklistSummary;
	/** The group it is shown in, so its screen leads back there. */
	groupId?: string;
}) {
	const { progress } = checklist;
	const { apply } = useApplyChange();
	const { canManageContent } = useItemPermissions(checklist.access);

	function setFlag(
		patch: { urgent: boolean } | { important: boolean } | { focused: boolean },
	) {
		apply({
			kind: "checklist.update",
			checklistId: checklist.checklistId,
			patch,
		});
	}

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

	const flags = canManageContent ? (
		<>
			<TaskFlagButtons
				title={checklist.title}
				urgent={checklist.urgent ?? false}
				important={checklist.important ?? false}
				hasShortcuts={false}
				actions={{
					onSetUrgent: (urgent) => setFlag({ urgent }),
					onSetImportant: (important) => setFlag({ important }),
				}}
			/>
			<FocusButton
				title={checklist.title}
				isOn={checklist.focused ?? false}
				onToggle={(focused) => setFlag({ focused })}
			/>
		</>
	) : null;

	return (
		<ClickableCard
			label={`${checklist.title}, ${progress.percent}% complete${priorityWords(checklist)}`}
			href={`/checklists/${checklist.checklistId}${groupId === undefined ? "" : `?group=${groupId}`}`}
			padding={3}
		>
			<VStack gap={2}>
				<HStack gap={2} hAlign="between" vAlign="center">
					<HStack gap={1.5} vAlign="center" className="thunderlist-card-title">
						{/* First, as on a task row; see `TaskFlagButtons`. */}
						{flags === null ? null : (
							<div className="thunderlist-row-buttons hidden shrink-0 items-center md:flex">
								{flags}
							</div>
						)}
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
						{canManageContent ? null : <PriorityMarks {...checklist} />}
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

				<CardLastLine summary={summary} flags={flags} />
			</VStack>
		</ClickableCard>
	);
}
