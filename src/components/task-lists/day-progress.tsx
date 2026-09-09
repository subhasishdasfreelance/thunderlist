import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useEffect, useState } from "react";
import { PaceLabel } from "#/components/common/pace-label";
import { ProgressMeter } from "#/components/common/progress-meter";
import { type Stat, StatGrid } from "#/components/common/stat-grid";
import { dayPace, formatHoursLeft, formatTimeOfDay } from "#/lib/day-pace";

/** A minute is as fine as any of these figures are worth showing. */
const TICK_MS = 60_000;

/**
 * The current time, once the browser has it.
 *
 * `null` on the server and for the first client render, because the server
 * cannot know the viewer's clock and rendering one would make the markup React
 * hydrates disagree with the markup it was sent.
 */
function useNow(): Date | null {
	const [now, setNow] = useState<Date | null>(null);

	useEffect(() => {
		setNow(new Date());
		const timer = setInterval(() => setNow(new Date()), TICK_MS);
		return () => clearInterval(timer);
	}, []);

	return now;
}

function rate(value: number): string {
	return `${Math.round(value * 10) / 10} tasks/hr`;
}

function stats(pace: ReturnType<typeof dayPace>, isDone: boolean): Array<Stat> {
	return [
		{
			label: "Current speed",
			value: pace.perHour === null ? "—" : rate(pace.perHour),
			hint: `over ${formatHoursLeft(pace.hoursElapsed)}`,
		},
		{
			label: "Expected speed",
			value: pace.expectedPerHour === null ? "—" : rate(pace.expectedPerHour),
		},
		isDone
			? { label: "Needed from now", value: "Done" }
			: {
					label: "Needed from now",
					value:
						pace.requiredPerHour === null ? "—" : rate(pace.requiredPerHour),
				},
		{
			label: "Finishing",
			value: isDone
				? "Done"
				: pace.projectedFinish === null
					? "Not moving yet"
					: formatTimeOfDay(pace.projectedFinish),
		},
		{ label: "Day ends", value: formatTimeOfDay(pace.endsAt) },
		{ label: "Time left", value: formatHoursLeft(pace.hoursRemaining) },
	];
}

/**
 * How today is going, against the clock.
 *
 * Today is the one list with a deadline it did not choose: midnight. So it gets
 * the same reading every checklist gets — how much is done, how much of the
 * time has gone, and whether those two agree — but measured in hours, because
 * a day measured in days never moves.
 *
 * The window is worked out from the current time on every tick, so crossing
 * midnight simply starts measuring against the next one. The tasks on the list
 * are not touched by that; only the clock they are being read against changes.
 */
export function DayProgress({
	total,
	completed,
}: {
	total: number;
	completed: number;
}) {
	const now = useNow();
	if (now === null || total === 0) return null;

	const pace = dayPace({ total, completed, now });
	const percent = Math.round((completed / total) * 100);
	const isDone = completed >= total;

	return (
		<VStack gap={3}>
			<Card padding={3}>
				<VStack gap={2}>
					<HStack gap={2} hAlign="between" vAlign="center">
						<Text weight="medium">{percent}% of today done</Text>
						<PaceLabel status={pace.status} />
					</HStack>
					<ProgressMeter
						label="Today's progress"
						percent={percent}
						expectedPercent={pace.elapsed * 100}
						footnote={`${completed} / ${total} ${total === 1 ? "task" : "tasks"} · ${formatHoursLeft(
							pace.hoursRemaining,
						)} left today`}
					/>
				</VStack>
			</Card>

			<StatGrid stats={stats(pace, isDone)} />
		</VStack>
	);
}
