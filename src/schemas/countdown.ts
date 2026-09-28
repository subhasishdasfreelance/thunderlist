import * as v from "valibot";
import { dateOnlySchema, idSchema, titleSchema } from "./common";
import { TAG_COLORS, type TagColor } from "./tag";

/**
 * A countdown: a day to count down to — a launch, a trip, a review — and
 * nothing else. No tasks, no target, just how many days are left.
 */
export type Countdown = {
	countdownId: string;
	title: string;
	/** `YYYY-MM-DD`: the day it counts down to. */
	date: string;
	color: TagColor;
	createdAt: string;
	updatedAt: string;
};

export const countdownIdInputSchema = v.object({ countdownId: idSchema });

export const createCountdownInputSchema = v.object({
	countdownId: idSchema,
	title: titleSchema,
	date: dateOnlySchema,
	color: v.picklist(TAG_COLORS),
});

export const updateCountdownInputSchema = v.object({
	countdownId: idSchema,
	patch: v.pipe(
		v.object({
			title: v.optional(titleSchema),
			date: v.optional(dateOnlySchema),
			color: v.optional(v.picklist(TAG_COLORS)),
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
export function orderCountdowns<T extends Pick<Countdown, "date">>(
	countdowns: ReadonlyArray<T>,
	today: string,
): { upcoming: Array<T>; past: Array<T> } {
	const upcoming = countdowns
		.filter((each) => each.date >= today)
		.sort((a, b) => a.date.localeCompare(b.date));
	const past = countdowns
		.filter((each) => each.date < today)
		.sort((a, b) => b.date.localeCompare(a.date));
	return { upcoming, past };
}
