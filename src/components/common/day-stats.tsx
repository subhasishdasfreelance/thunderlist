import { Spinner } from "@astryxdesign/core/Spinner";
import { dayPace, formatFinish, formatHoursLeft } from "#/lib/day-pace";
import { formatClock } from "#/lib/format-date";
import { todayWindow } from "#/lib/progress";
import type { DailyWindow } from "#/schemas/common";
import { type Stat, StatGrid } from "./stat-grid";

function rate(value: number): string {
	return `${Math.round(value * 10) / 10} tasks/hr`;
}

/** The labels of the figures below, in their order, drawn while the clock loads. */
const PENDING_LABELS = [
	"Starts",
	"Planned time",
	"Time passed",
	"Time left",
	"Current speed",
	"Expected speed",
	"Needed from now",
	"Finishing",
];

/**
 * How today is going, against the clock: the figures for something paced to a
 * daily window, in place of the ones counted in days.
 *
 * The same figures every checklist gets, in the same order — measured in
 * hours, because a day measured in days never moves. Today's window is worked
 * out afresh on every minute's tick, so tomorrow simply measures against
 * tomorrow's.
 *
 * Only the labels are drawn until the browser has the time, and the finished
 * tasks to measure today's speed from; see `useNow`.
 */
export function DayStats({
	total,
	completed,
	finishedAt,
	window,
	now,
}: {
	total: number;
	completed: number;
	/** When each finished task was finished; `undefined` while loading. */
	finishedAt: ReadonlyArray<string | null> | undefined;
	window: DailyWindow;
	now: number | null;
}) {
	const moments = now === null ? null : todayWindow(window, now);
	// The grid is held open with its labels, so nothing below it jumps when
	// the figures arrive. The Current speed hint's line is held too.
	if (now === null || moments === null || finishedAt === undefined) {
		return (
			<StatGrid
				stats={PENDING_LABELS.map((label) => ({
					label,
					value: <Spinner size="sm" aria-label={`Loading ${label}`} />,
					hint: label === "Current speed" ? " " : undefined,
				}))}
			/>
		);
	}

	const pace = dayPace({
		total,
		completed,
		completedToday: finishedAt.filter(
			(at) => at !== null && Date.parse(at) >= moments.start,
		).length,
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
					: formatFinish(pace.projectedFinish, new Date(now)),
			hint:
				pace.projectedFinish === null || isDone ? undefined : "at this speed",
		},
	];

	return <StatGrid stats={stats} />;
}
