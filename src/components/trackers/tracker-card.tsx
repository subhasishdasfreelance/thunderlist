import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { PaceLabel } from "#/components/common/pace-label";
import { ProgressMeter } from "#/components/common/progress-meter";
import { velocitySummary } from "#/components/common/velocity-stats";
import { computeVelocity, elapsedFraction } from "#/lib/progress";
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

export function TrackerCard({ tracker }: { tracker: TrackerSummary }) {
	const { progress } = tracker;

	const elapsed = elapsedFraction({
		startDate: tracker.startDate,
		deadline: tracker.deadline,
	});

	const summary = velocitySummary(
		computeVelocity({
			startDate: tracker.startDate,
			deadline: tracker.deadline,
			current: progress.current,
			target: progress.target,
		}),
		tracker.unit,
		progress.current >= progress.target && progress.target > 0,
	);

	return (
		<ClickableCard
			label={`${tracker.title}, ${progress.percent}% complete`}
			href={`/trackers/${tracker.trackerId}`}
			padding={3}
		>
			<HStack gap={3} vAlign="center">
				{tracker.coverUrl ? (
					<img
						src={tracker.coverUrl}
						alt=""
						loading="lazy"
						className="h-16 w-12 shrink-0 rounded-sm border border-border object-cover"
					/>
				) : null}

				<VStack gap={2} width="100%">
					<HStack gap={2} hAlign="between" vAlign="center">
						<Text weight="medium" maxLines={1}>
							{tracker.title}{" "}
							<Text color="secondary" weight="normal">
								({progress.percent}%)
							</Text>
						</Text>
						<PaceLabel status={tracker.status} />
					</HStack>

					<ProgressMeter
						label={`${tracker.title} progress`}
						percent={progress.percent}
						expectedPercent={elapsed === null ? null : elapsed * 100}
						footnote={formatProgress(
							progress.current,
							progress.target,
							tracker.unit,
						)}
					/>

					{summary === null ? null : <Text type="supporting">{summary}</Text>}
				</VStack>
			</HStack>
		</ClickableCard>
	);
}
