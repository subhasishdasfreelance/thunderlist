import * as v from "valibot";
import { type AccessEntry, accessSchema } from "./access";
import {
	dateOnlySchema,
	idSchema,
	timeOfDaySchema,
	titleSchema,
} from "./common";
import { TAG_COLORS, type TagColor } from "./tag";

export type CountdownUnit =
	| "years"
	| "months"
	| "weeks"
	| "days"
	| "hours"
	| "minutes"
	| "seconds";

/**
 * How a countdown shows the time left: the units it is broken into, largest
 * first. The first takes the whole of what it can — "Hours only" is every hour
 * left — and the last drops what is smaller than it. The ids of the first four
 * were all there were once, and are stored as they are.
 */
export const COUNTDOWN_FORMAT_UNITS = {
	seconds: ["years", "months", "days", "hours", "minutes", "seconds"],
	minutes: ["years", "months", "days", "hours", "minutes"],
	hours: ["years", "months", "days", "hours"],
	calendar: ["years", "months", "days"],
	"months-days": ["months", "days"],
	weeks: ["weeks", "days"],
	"days-seconds": ["days", "hours", "minutes", "seconds"],
	"days-minutes": ["days", "hours", "minutes"],
	"days-hours": ["days", "hours"],
	"hours-seconds": ["hours", "minutes", "seconds"],
	"hours-minutes": ["hours", "minutes"],
	"weeks-only": ["weeks"],
	days: ["days"],
	"hours-only": ["hours"],
	"minutes-only": ["minutes"],
	"seconds-only": ["seconds"],
} as const satisfies Record<string, ReadonlyArray<CountdownUnit>>;

export type CountdownFormat = keyof typeof COUNTDOWN_FORMAT_UNITS;

export const COUNTDOWN_FORMATS = Object.keys(
	COUNTDOWN_FORMAT_UNITS,
) as Array<CountdownFormat>;

export const COUNTDOWN_FORMAT_LABELS: Record<CountdownFormat, string> = {
	seconds: "Years, months, days, hours, minutes and seconds",
	minutes: "Years, months, days, hours and minutes",
	hours: "Years, months, days and hours",
	calendar: "Years, months and days",
	"months-days": "Months and days",
	weeks: "Weeks and days",
	"days-seconds": "Days, hours, minutes and seconds",
	"days-minutes": "Days, hours and minutes",
	"days-hours": "Days and hours",
	"hours-seconds": "Hours, minutes and seconds",
	"hours-minutes": "Hours and minutes",
	"weeks-only": "Weeks only",
	days: "Days only",
	"hours-only": "Hours only",
	"minutes-only": "Minutes only",
	"seconds-only": "Seconds only",
};

/** The formats, as the form offers them: in groups of a kind. */
export const COUNTDOWN_FORMAT_GROUPS: ReadonlyArray<{
	title: string;
	formats: ReadonlyArray<CountdownFormat>;
}> = [
	{
		title: "On the calendar",
		formats: ["seconds", "minutes", "hours", "calendar", "months-days", "weeks"],
	},
	{
		title: "In days and hours",
		formats: [
			"days-seconds",
			"days-minutes",
			"days-hours",
			"hours-seconds",
			"hours-minutes",
		],
	},
	{
		title: "As one number",
		formats: ["weeks-only", "days", "hours-only", "minutes-only", "seconds-only"],
	},
];

/** Whether a format counts to the second, so has to be drawn every second. */
export const ticksEverySecond = (format: CountdownFormat): boolean =>
	(COUNTDOWN_FORMAT_UNITS[format] as ReadonlyArray<CountdownUnit>).includes(
		"seconds",
	);

/**
 * A countdown: a day to count down to — a launch, a trip, a review — and
 * nothing else. No tasks, no target, just how long is left.
 */
export type Countdown = {
	countdownId: string;
	/** `CD-2`, for people; absent until the server hands it one. See `NUMBER_PREFIXES`. */
	number?: number;
	title: string;
	/** `YYYY-MM-DD`: the day it counts down to. */
	date: string;
	/** `HH:MM` on that day it counts down to; absent or `null` for its start. */
	time?: string | null;
	color: TagColor;
	/** Absent on one made before there was a choice: `seconds`. */
	format?: CountdownFormat;
	/**
	 * In a team, who may do what with it; absent or `null` for everyone, each
	 * at whatever their role allows. See `accessSchema`.
	 */
	access?: Array<AccessEntry> | null;
	createdAt: string;
	updatedAt: string;
};

export const countdownIdInputSchema = v.object({ countdownId: idSchema });

export const createCountdownInputSchema = v.object({
	countdownId: idSchema,
	title: titleSchema,
	date: dateOnlySchema,
	time: v.optional(v.nullable(timeOfDaySchema), null),
	color: v.picklist(TAG_COLORS),
	format: v.picklist(COUNTDOWN_FORMATS),
	access: v.optional(accessSchema, null),
});

export const updateCountdownInputSchema = v.object({
	countdownId: idSchema,
	patch: v.pipe(
		v.object({
			title: v.optional(titleSchema),
			date: v.optional(dateOnlySchema),
			time: v.optional(v.nullable(timeOfDaySchema)),
			color: v.optional(v.picklist(TAG_COLORS)),
			format: v.optional(v.picklist(COUNTDOWN_FORMATS)),
			access: v.optional(accessSchema),
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days from one `YYYY-MM-DD` to another: positive while `date` is still
 * ahead, 0 on the day, negative once it has passed. Counted on the calendar,
 * so a clock change never makes a day of 23 hours count as none.
 */
export function daysUntil(date: string, today: string): number {
	const at = (value: string) => {
		const [year, month, day] = value.split("-").map(Number);
		return Date.UTC(year, month - 1, day);
	};
	return Math.round((at(date) - at(today)) / DAY_MS);
}

/** Soonest first; the ones already past follow, the most recent first. */
export function orderCountdowns<T extends Pick<Countdown, "date" | "time">>(
	countdowns: ReadonlyArray<T>,
	today: string,
): { upcoming: Array<T>; past: Array<T> } {
	// A day with no time is its start, so it comes before any time on it.
	const when = (each: T) => `${each.date} ${each.time ?? ""}`;
	const upcoming = countdowns
		.filter((each) => each.date >= today)
		.sort((a, b) => when(a).localeCompare(when(b)));
	const past = countdowns
		.filter((each) => each.date < today)
		.sort((a, b) => when(b).localeCompare(when(a)));
	return { upcoming, past };
}

/** A month on from `from` — or `count` of them — on the same day where there is one. */
function addMonths(from: Date, count: number): Date {
	const next = new Date(from);
	next.setDate(1);
	next.setMonth(next.getMonth() + count);
	const lastDay = new Date(
		next.getFullYear(),
		next.getMonth() + 1,
		0,
	).getDate();
	next.setDate(Math.min(from.getDate(), lastDay));
	return next;
}

/** Whole months from `from` to `to`, `from` being the earlier. */
function monthsBetween(from: Date, to: Date): number {
	let months =
		(to.getFullYear() - from.getFullYear()) * 12 +
		(to.getMonth() - from.getMonth());
	if (addMonths(from, months) > to) months -= 1;
	return months;
}

const CLOCK_UNITS: ReadonlyArray<CountdownUnit> = ["hours", "minutes", "seconds"];

/** Seconds in each unit of a fixed length; months and years are not. */
const UNIT_SECONDS: Partial<Record<CountdownUnit, number>> = {
	weeks: 604_800,
	days: 86_400,
	hours: 3600,
	minutes: 60,
	seconds: 1,
};

/**
 * How long there is to go — or, once the moment has passed, how long ago it
 * was — broken into the units `format` shows, largest first. A leading unit
 * that is 0 is left out, so a month away does not read "0 years"; from the
 * first of the hours, minutes and seconds on, every unit shows, as a clock
 * does. On the day itself there is nothing — except, in a format with a
 * clock, the time still left before its `time`.
 *
 * `now` is a moment. A format with a clock counts from it to `time` on the
 * day, on the viewer's clock, or to the day's midnight without one. The rest
 * count whole calendar days, as `daysUntil`, so a time makes no difference to
 * them.
 */
export function countdownParts(
	date: string,
	now: number,
	format: CountdownFormat,
	time?: string | null,
): Array<{ unit: CountdownUnit; value: number }> {
	const units: ReadonlyArray<CountdownUnit> = COUNTDOWN_FORMAT_UNITS[format];
	const hasClock = units.some((unit) => CLOCK_UNITS.includes(unit));
	const moment = new Date(now);
	const today = [
		moment.getFullYear(),
		String(moment.getMonth() + 1).padStart(2, "0"),
		String(moment.getDate()).padStart(2, "0"),
	].join("-");
	const days = daysUntil(date, today);
	const [year, month, day] = date.split("-").map(Number);
	const [hours, minutes] = (time ?? "00:00").split(":").map(Number);
	const target = new Date(year, month - 1, day, hours, minutes);
	if (days === 0 && !(hasClock && moment < target)) return [];

	// A clock counts from this moment to the very one; calendar days from
	// today's midnight to the day's.
	const [start, end] = hasClock
		? [moment, target]
		: [
				new Date(moment.getFullYear(), moment.getMonth(), moment.getDate()),
				new Date(year, month - 1, day),
			];
	const [from, to] = start < end ? [start, end] : [end, start];

	const values = new Map<CountdownUnit, number>();
	let restMs = to.getTime() - from.getTime();
	if (units.includes("months")) {
		const months = monthsBetween(from, to);
		restMs = to.getTime() - addMonths(from, months).getTime();
		if (units.includes("years")) {
			values.set("years", Math.floor(months / 12));
			values.set("months", months % 12);
		} else {
			values.set("months", months);
		}
	}
	// In whole seconds; or in whole days, rounded, since a clock change makes
	// a day from midnight to midnight 23 hours.
	let rest = hasClock
		? Math.floor(restMs / 1000)
		: Math.round(restMs / 86_400_000) * 86_400;
	for (const unit of units) {
		const size = UNIT_SECONDS[unit];
		if (size === undefined) continue;
		values.set(unit, Math.floor(rest / size));
		rest %= size;
	}

	const parts = units.map((unit) => ({ unit, value: values.get(unit) ?? 0 }));
	const alwaysShown = hasClock
		? units.findIndex((unit) => CLOCK_UNITS.includes(unit))
		: units.length - 1;
	return parts.slice(
		parts.findIndex((part, index) => part.value !== 0 || index >= alwaysShown),
	);
}
