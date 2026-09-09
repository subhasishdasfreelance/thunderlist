/**
 * How today is going, measured in hours rather than days.
 *
 * Every other pace figure in the app spans weeks, so whole days are the right
 * grain for them. Today is one day: measured that way it would read "0 of 1
 * days elapsed" from breakfast until midnight and never move. So this measures
 * the same things against the clock instead.
 *
 * The window is always midnight to midnight, worked out from the moment it is
 * asked. Nothing is stored, so crossing midnight simply starts reporting
 * against the next one — the tasks on the list are untouched by it.
 *
 * Pure, apart from taking the current time as an argument.
 */

import type { PaceStatus } from "#/schemas/checklist";

const MS_PER_HOUR = 3_600_000;
const HOURS_PER_DAY = 24;

/** Matches `paceStatus`, so "Behind" means the same thing on every screen. */
const PACE_TOLERANCE = 0.1;

export type DayPace = {
	/** Midnight at the end of today: what the day is being measured against. */
	endsAt: Date;
	/** How much of the day has gone, 0-1. */
	elapsed: number;
	hoursElapsed: number;
	hoursRemaining: number;
	/** Tasks finished per hour so far. `null` before the first whole minute. */
	perHour: number | null;
	/** What the whole day asked for, spread evenly. */
	expectedPerHour: number | null;
	/** What it takes from now to clear the list by midnight. */
	requiredPerHour: number | null;
	/** When the list is cleared at the current rate, or `null` if never. */
	projectedFinish: Date | null;
	status: PaceStatus | null;
};

/** Midnight at the start of the day `now` falls in. */
function startOfDay(now: Date): Date {
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function dayPace(input: {
	total: number;
	completed: number;
	now: Date;
}): DayPace {
	const { total, completed, now } = input;

	const start = startOfDay(now);
	const endsAt = new Date(start.getTime() + HOURS_PER_DAY * MS_PER_HOUR);

	const hoursElapsed = (now.getTime() - start.getTime()) / MS_PER_HOUR;
	const hoursRemaining = Math.max(
		0,
		(endsAt.getTime() - now.getTime()) / MS_PER_HOUR,
	);
	const elapsed = Math.min(1, Math.max(0, hoursElapsed / HOURS_PER_DAY));

	const outstanding = Math.max(0, total - completed);

	// An empty list has no pace to report; a rate over the first few seconds of
	// the day is noise rather than information.
	const perHour =
		total === 0 || hoursElapsed < 0.25 ? null : completed / hoursElapsed;
	const expectedPerHour = total === 0 ? null : total / HOURS_PER_DAY;
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

	const status =
		total === 0
			? null
			: (() => {
					const drift = completed / total - elapsed;
					if (drift > PACE_TOLERANCE) return "ahead" as const;
					if (drift < -PACE_TOLERANCE) return "behind" as const;
					return "on_track" as const;
				})();

	return {
		endsAt,
		elapsed,
		hoursElapsed,
		hoursRemaining,
		perHour,
		expectedPerHour,
		requiredPerHour,
		projectedFinish,
		status,
	};
}

/** "3h 20m left", or "18m left" once the hours have gone. */
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
