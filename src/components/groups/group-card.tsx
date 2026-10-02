import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Folder } from "lucide-react";
import { ITEM_KIND_ICONS } from "#/components/common/item-picker-dialog";
import { PaceLabel } from "#/components/common/pace-label";
import {
	formatExpectedTasks,
	ProgressMeter,
} from "#/components/common/progress-meter";
import { stageColorStyle } from "#/components/common/stage-dot";
import { velocitySummary } from "#/components/common/velocity-stats";
import { formatSchedule } from "#/lib/format-date";
import { computeVelocity } from "#/lib/progress";
import { usePace } from "#/lib/use-pace";
import { type Group, groupStartDate } from "#/schemas/group";
import { describeContents, type GroupContents } from "./group-contents";

const PREVIEW = 4;

/** A group's mark: a folder in its colour. */
export function GroupBadge({
	group,
	size = "md",
}: {
	group: Pick<Group, "color">;
	size?: "md" | "lg";
}) {
	return (
		<span
			aria-hidden
			className="thunderlist-group-badge"
			data-size={size}
			style={stageColorStyle(group.color)}
		>
			<Folder />
		</span>
	);
}

/**
 * A group at a glance: its name in its colour, what it holds, how far along
 * all of that is together and its pace, the way a tag card shows a tag's, and
 * the first few things in it.
 */
export function GroupCard({
	group,
	contents,
}: {
	group: Group;
	contents: GroupContents;
}) {
	const { total, completed } = contents;
	const schedule = {
		startDate: groupStartDate(group),
		deadline: group.deadline ?? null,
		deadlineTime: group.deadlineTime ?? null,
	};
	const pace = usePace(schedule, total === 0 ? null : completed / total);
	const summary =
		total === 0 || pace.now === null
			? null
			: velocitySummary(
					computeVelocity({
						...schedule,
						current: completed,
						target: total,
						now: pace.now,
					}),
					"tasks",
					completed >= total,
				);

	const preview = [
		...contents.checklists.map((each) => ({
			key: each.checklistId,
			kind: "checklist" as const,
			label: each.title,
		})),
		...contents.trackers.map((each) => ({
			key: each.trackerId,
			kind: "tracker" as const,
			label: each.title,
		})),
		...contents.tags.map((each) => ({
			key: each.tagId,
			kind: "tag" as const,
			label: `#${each.name}`,
		})),
	];

	return (
		<ClickableCard
			label={
				contents.percent === null
					? group.name
					: `${group.name}, ${contents.percent}% complete`
			}
			href={`/groups/${group.groupId}`}
			padding={3}
		>
			<VStack gap={2}>
				<HStack gap={2} hAlign="between" vAlign="center">
					<HStack gap={2} vAlign="center">
						<GroupBadge group={group} />
						<VStack gap={0}>
							<Text weight="medium" maxLines={1}>
								{group.name}
								{contents.percent === null ? null : (
									<Text color="secondary" weight="normal">
										{" "}
										({contents.percent}%)
									</Text>
								)}
							</Text>
							<Text type="supporting">{describeContents(contents)}</Text>
						</VStack>
					</HStack>
					<PaceLabel status={pace.status} />
				</HStack>

				{contents.percent === null ? null : (
					<ProgressMeter
						label={`${group.name} progress`}
						percent={contents.percent}
						elapsed={pace.elapsed}
						expectedReading={
							pace.elapsed == null
								? undefined
								: formatExpectedTasks(pace.elapsed, total)
						}
						footnote={formatSchedule(schedule)}
					/>
				)}

				{summary === null ? null : <Text type="supporting">{summary}</Text>}

				{preview.length === 0 ? null : (
					<div className="thunderlist-group-preview">
						{preview.slice(0, PREVIEW).map((item) => (
							<span key={`${item.kind}:${item.key}`}>
								<Icon icon={ITEM_KIND_ICONS[item.kind]} size="xsm" />
								<span className="truncate">{item.label}</span>
							</span>
						))}
						{preview.length > PREVIEW ? (
							<span>+{preview.length - PREVIEW} more</span>
						) : null}
					</div>
				)}
			</VStack>
		</ClickableCard>
	);
}
