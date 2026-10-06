import * as v from "valibot";
import { type AccessEntry, accessSchema } from "./access";
import {
	dateOnlySchema,
	idSchema,
	timeOfDaySchema,
	titleSchema,
} from "./common";
import { TAG_COLORS, type TagColor } from "./tag";

/**
 * How a countdown shows the time left:
 *
 * - `seconds` — years, months, days, hours, minutes and seconds, ticking.
 * - `calendar` — years, months and days.
 * - `weeks` — weeks and days.
 * - `days` — days alone.
 */
export const COUNTDOWN_FORMATS = [
	"seconds",
	"calendar",
	"weeks",
	"days",
] as const;

export type CountdownFormat = (typeof COUNTDOWN_FORMATS)[number];

export const COUNTDOWN_FORMAT_LABELS: Record<CountdownFormat, string> = {
	seconds: "To the second",
	calendar: "Years, months and days",
	weeks: "Weeks and days",
	days: "Days only",
};

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

export type CountdownUnit =
	| "years"
	| "months"
	| "weeks"
	| "days"
	| "hours"
	| "minutes"
	| "seconds";

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

/**
 * How long there is to go — or, once the day has passed, how long ago it
 * was — broken into the units `format` shows, largest first. A leading unit
 * that is 0 is left out, so a month away does not read "0 years"; the hours,
 * minutes and seconds always show. On the day itself there is nothing —
 * except, to the second, the hours still left before its `time`.
 *
 * `now` is a moment; the moment counted to is `time` on the viewer's clock,
 * or the day's midnight without one. Every format but `seconds` counts whole
 * calendar days, as `daysUntil`, so a time makes no difference to them.
 */
export function countdownParts(
	date: string,
	now: number,
	format: CountdownFormat,
	time?: string | null,
): Array<{ unit: CountdownUnit; value: number }> {
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
	const isTimeAheadToday = format === "seconds" && moment < target;
	if (days === 0 && !isTimeAheadToday) return [];

	const parts: Array<{ unit: CountdownUnit; value: number }> = [];
	const alwaysShown: CountdownUnit = format === "seconds" ? "hours" : "days";
	const trimmed = () =>
		parts.slice(
			parts.findIndex((part) => part.value !== 0 || part.unit === alwaysShown),
		);

	if (format === "days") return [{ unit: "days", value: Math.abs(days) }];
	if (format === "weeks") {
		parts.push(
			{ unit: "weeks", value: Math.floor(Math.abs(days) / 7) },
			{ unit: "days", value: Math.abs(days) % 7 },
		);
		return trimmed();
	}

	const midnight = new Date(
		moment.getFullYear(),
		moment.getMonth(),
		moment.getDate(),
	);
	// Calendar days are counted from today's start to the day's, seconds from
	// this moment to the very one.
	const start = format === "calendar" ? midnight : moment;
	const end =
		format === "calendar" ? new Date(year, month - 1, day) : target;
	const [from, to] = start < end ? [start, end] : [end, start];

	const months = monthsBetween(from, to);
	const rest = to.getTime() - addMonths(from, months).getTime();
	const seconds = Math.floor(rest / 1000);

	parts.push(
		{ unit: "years", value: Math.floor(months / 12) },
		{ unit: "months", value: months % 12 },
		// Midnight to midnight, rounded: a clock change makes a day 23 hours.
		{
			unit: "days",
			value:
				format === "calendar"
					? Math.round(rest / 86_400_000)
					: Math.floor(seconds / 86_400),
		},
	);
	if (format === "seconds") {
		parts.push(
			{ unit: "hours", value: Math.floor(seconds / 3600) % 24 },
			{ unit: "minutes", value: Math.floor(seconds / 60) % 60 },
			{ unit: "seconds", value: seconds % 60 },
		);
	}
	return trimmed();
}
