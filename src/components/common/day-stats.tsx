import { dayPace, formatHoursLeft, formatTimeOfDay } from "#/lib/day-pace";
import { formatClock } from "#/lib/format-date";
import { todayWindow } from "#/lib/progress";
import type { DailyWindow } from "#/schemas/common";
import { type Stat, StatGrid } from "./stat-grid";

function rate(value: number): string {
	return `${Math.round(value * 10) / 10} tasks/hr`;
}

/**
 * How today is going, against the clock: the figures for something paced to a
 * daily window, in place of the ones counted in days.
 *
 * The same figures every checklist gets, in the same order — measured in
 * hours, because a day measured in days never moves. Today's window is worked
 * out afresh on every minute's tick, so tomorrow simply measures against
 * tomorrow's.
 *
 * Nothing is drawn until the browser has the time; see `useNow`.
 */
export function DayStats({
	total,
	completed,
	window,
	now,
}: {
	total: number;
	completed: number;
	window: DailyWindow;
	now: number | null;
}) {
	const moments = now === null ? null : todayWindow(window, now);
	if (now === null || moments === null) return null;

	const pace = dayPace({
		total,
		completed,
		now: new Date(now),
		window: moments,
	});
	const isDone = total > 0 && completed >= total;

	const stats: Array<Stat> = [
		{ label: "Starts", value: formatClock(window.from) },
		{ label: "Planned time", value: formatHoursLeft(pace.hoursInWindow) },
		{ label: "Time passed", value: formatHoursLeft(pace.hoursElapsed) },
		{ label: "Time left", value: formatHoursLeft(pace.hoursRemaining) },
		{
			label: "Current speed",
			value: pace.perHour === null ? "—" : rate(pace.perHour),
			hint: `over ${formatHoursLeft(pace.hoursElapsed)}`,
		},
		{
			label: "Expected speed",
			value: pace.expectedPerHour === null ? "—" : rate(pace.expectedPerHour),
		},
		{
			label: "Needed from now",
			value: isDone
				? "Done"
				: pace.requiredPerHour === null
					? "—"
					: rate(pace.requiredPerHour),
		},
		{
			label: "Finishing",
			value: isDone
				? "Done"
				: pace.projectedFinish === null
					? "Not moving yet"
					: formatTimeOfDay(pace.projectedFinish),
			hint:
				pace.projectedFinish === null || isDone ? undefined : "at this speed",
		},
	];

	return <StatGrid stats={stats} />;
}
