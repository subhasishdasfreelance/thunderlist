import { formatDate } from "#/lib/format-date";
import type { Velocity } from "#/schemas/progress";
import { type Stat, StatGrid } from "./stat-grid";

/** One decimal place: "12.4 pages/day" reads better than "12.428…". */
function rate(value: number, unit: string): string {
	return `${Math.round(value * 10) / 10} ${unit}/day`;
}

/**
 * A stretch of time, to the grain worth reading: "26d 4h", "5h 20m", "18m".
 *
 * The figures behind it are worked out to the minute, but minutes on top of
 * whole days are not something anyone plans by, so they are left off then.
 */
function duration(minutes: number): string {
	const whole = Math.round(minutes);
	const days = Math.floor(whole / 1440);
	const hours = Math.floor((whole % 1440) / 60);
	const rest = whole % 60;

	if (days > 0) return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
	if (hours > 0) return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
	return `${rest}m`;
}

/**
 * A figure that only exists when the number behind it does.
 *
 * Most of these are `null` for the same reason — no deadline to measure
 * against, or no movement yet — so saying that once keeps the list readable.
 */
function figure(
	label: string,
	value: number | null,
	format: (value: number) => string,
	missing: string,
	hint?: string,
): Stat {
	return { label, value: value === null ? missing : format(value), hint };
}

/**
 * The figures behind "am I going fast enough".
 *
 * Anything the dates cannot support says so instead of showing a number the
 * history does not justify — a goal with no deadline genuinely has no expected
 * speed, and one that has not moved has no finish date.
 */
function velocityStats(
	velocity: Velocity,
	unit: string,
	isComplete: boolean,
	startDate: string,
): Array<Stat> {
	const {
		perDay,
		expectedPerDay,
		requiredPerDay,
		projectedFinish,
		minutesElapsed,
		minutesRemaining,
		totalMinutes,
	} = velocity;

	const perDayIn = (value: number) => rate(value, unit);
	const noDeadline = "No deadline";

	return [
		// When the clock started. Every other figure is measured from it, so it
		// comes first: without it the speeds are numbers with no window.
		{ label: "Started", value: formatDate(startDate) },
		// The time, then the speeds: on a wide screen that is a row of each.
		figure("Planned time", totalMinutes, duration, noDeadline),
		{ label: "Time passed", value: duration(minutesElapsed) },
		figure(
			"Time left",
			minutesRemaining,
			(value) => (value < 0 ? `${duration(-value)} over` : duration(value)),
			noDeadline,
		),
		figure(
			"Current speed",
			perDay,
			perDayIn,
			"—",
			`over ${duration(minutesElapsed)}`,
		),
		figure("Expected speed", expectedPerDay, perDayIn, noDeadline),
		isComplete
			? { label: "Needed from now", value: "Done" }
			: figure("Needed from now", requiredPerDay, perDayIn, noDeadline),
		isComplete
			? { label: "Finishing", value: "Complete" }
			: {
					label: "Finishing",
					value:
						projectedFinish === null
							? "Not moving yet"
							: formatDate(projectedFinish),
					hint: projectedFinish === null ? undefined : "at this speed",
				},
	];
}

/**
 * A single line for a card, where a full grid would crowd out the thing the
 * card is actually about.
 */
export function velocitySummary(
	velocity: Velocity,
	unit: string,
	isComplete: boolean,
): string | null {
	if (isComplete) return "Complete";
	if (velocity.perDay === null || velocity.perDay <= 0) return null;

	const pace = rate(velocity.perDay, unit);
	return velocity.projectedFinish === null
		? pace
		: `${pace} · finishing ${formatDate(velocity.projectedFinish)}`;
}

export function VelocityStats({
	velocity,
	unit,
	isComplete,
	startDate,
}: {
	/**
	 * Worked out on the viewer's own clock, so `null` until the browser has it
	 * — and nothing is drawn until then; see `useNow`.
	 */
	velocity: Velocity | null;
	unit: string;
	isComplete: boolean;
	/** The day the work began; every other figure is measured from it. */
	startDate: string;
}) {
	if (velocity === null) return null;

	return (
		<StatGrid stats={velocityStats(velocity, unit, isComplete, startDate)} />
	);
}
