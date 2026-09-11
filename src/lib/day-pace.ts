/**
 * How a day is going, measured in hours rather than days.
 *
 * Every other pace figure in the app spans weeks, so whole days are the right
 * grain for them. Something paced to a daily window — Today, from six in the
 * morning to ten at night — is one day long, again and again: measured in days
 * it would read "0 of 1 days elapsed" all day and never move. So this measures
 * the same things against the clock instead.
 *
 * The window is today's, worked out from the moment it is asked. Nothing is
 * stored, so tomorrow simply reports against tomorrow's — the tasks themselves
 * are untouched by it.
 *
 * Pure, apart from taking the current time as an argument.
 */

const MS_PER_HOUR = 3_600_000;

export type DayPace = {
	/** When today's window opens and closes. */
	startsAt: Date;
	endsAt: Date;
	/** Its length, which can be fractional: 06:00 to 10:30 is 4.5. */
	hoursInWindow: number;
	hoursElapsed: number;
	hoursRemaining: number;
	/** Tasks finished per hour so far. `null` before the first quarter hour. */
	perHour: number | null;
	/** What the whole window asked for, spread evenly. */
	expectedPerHour: number | null;
	/** What it takes from now to clear the list before the window closes. */
	requiredPerHour: number | null;
	/** When the list is cleared at the current rate, or `null` if never. */
	projectedFinish: Date | null;
};

export function dayPace(input: {
	total: number;
	completed: number;
	now: Date;
	/** Today's window, as two moments; see `todayWindow`. */
	window: { start: number; end: number };
}): DayPace {
	const { total, completed, now, window } = input;

	const hoursInWindow = (window.end - window.start) / MS_PER_HOUR;
	const withinWindow = (hours: number) =>
		Math.min(hoursInWindow, Math.max(0, hours));

	const hoursElapsed = withinWindow(
		(now.getTime() - window.start) / MS_PER_HOUR,
	);
	const hoursRemaining = withinWindow(
		(window.end - now.getTime()) / MS_PER_HOUR,
	);

	const outstanding = Math.max(0, total - completed);

	// An empty list has no pace to report; a rate over the first few minutes of
	// the window is noise rather than information.
	const perHour =
		total === 0 || hoursElapsed < 0.25 ? null : completed / hoursElapsed;
	const expectedPerHour = total === 0 ? null : total / hoursInWindow;
	const requiredPerHour =
		total === 0
			? null
			: outstanding === 0
				? 0
				: outstanding / Math.max(hoursRemaining, 1 / 60);

	const projectedFinish =
		outstanding === 0 || perHour === null || perHour <= 0
			? null
			: new Date(now.getTime() + (outstanding / perHour) * MS_PER_HOUR);

	return {
		startsAt: new Date(window.start),
		endsAt: new Date(window.end),
		hoursInWindow,
		hoursElapsed,
		hoursRemaining,
		perHour,
		expectedPerHour,
		requiredPerHour,
		projectedFinish,
	};
}

/** "3h 20m", or "18m" once the hours have gone. */
export function formatHoursLeft(hours: number): string {
	const whole = Math.floor(hours);
	const minutes = Math.round((hours - whole) * 60);

	if (whole === 0) return `${minutes}m`;
	if (minutes === 0) return `${whole}h`;
	return `${whole}h ${minutes}m`;
}

/** A time of day in the viewer's locale, e.g. "9:40 pm". */
export function formatTimeOfDay(value: Date): string {
	return value.toLocaleTimeString(undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
}
