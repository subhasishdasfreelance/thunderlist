import * as v from "valibot";
import { idSchema, timeOfDaySchema } from "./common";

/**
 * A daily notification, to one person, at a time of their day, about one
 * tracker or tag. It is set from that thing's edit dialog, and belongs to the
 * space it is in.
 *
 * Each is the person's own: a reminder on a team's tag reminds whoever set it,
 * not the team.
 */
const REMINDER_TARGETS = ["tracker", "tag"] as const;

export type ReminderTarget = (typeof REMINDER_TARGETS)[number];

export type Reminder = {
	target: ReminderTarget;
	/** The tracker or tag. */
	targetId: string;
	/** `HH:MM` on the person's own clock. */
	time: string;
};

/**
 * Set a reminder, change its time, or — with `time: null` — take it away.
 *
 * `timeZone` is the browser's, so "08:00" is eight in the morning wherever
 * the person is when they set it.
 */
export const setReminderInputSchema = v.object({
	target: v.picklist(REMINDER_TARGETS),
	targetId: idSchema,
	time: v.nullable(timeOfDaySchema),
	timeZone: v.pipe(
		v.string(),
		v.minLength(1),
		v.maxLength(64),
		v.check(isTimeZone, "That time zone isn't recognised."),
	),
});

/** Whether the clock can be read in this zone; an unknown one throws. */
function isTimeZone(timeZone: string): boolean {
	try {
		new Intl.DateTimeFormat("en", { timeZone });
		return true;
	} catch {
		return false;
	}
}

/** A push subscription, as the browser hands it over. */
export const pushSubscriptionInputSchema = v.object({
	endpoint: v.pipe(v.string(), v.url(), v.maxLength(2048)),
	keys: v.object({
		p256dh: v.pipe(v.string(), v.maxLength(256)),
		auth: v.pipe(v.string(), v.maxLength(256)),
	}),
});

export const pushEndpointInputSchema = v.object({
	endpoint: v.pipe(v.string(), v.url(), v.maxLength(2048)),
});

/** Where the person's clock stands in their time zone: the day and the minute. */
export function localClock(
	now: Date,
	timeZone: string,
): { date: string; time: string } {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		})
			.formatToParts(now)
			.map((part) => [part.type, part.value]),
	);

	return {
		date: `${parts.year}-${parts.month}-${parts.day}`,
		time: `${parts.hour}:${parts.minute}`,
	};
}

/** How late a missed reminder may still go out, in minutes. */
const LATEST = 180;

/**
 * Whether a reminder is due: its time last came round on its own clock, it
 * has not gone out for that day, and it is not so late that it would only be
 * noise.
 *
 * `today` is the day it is for — yesterday's, just after midnight, for one
 * set at 23:58 that the scheduler only reached at 00:03 — and is what
 * `lastSentOn` records, so the next day's still goes out.
 */
export function isDue(
	reminder: { time: string; timeZone: string; lastSentOn?: string | null },
	now: Date,
): { isDue: boolean; today: string } {
	const clock = localClock(now, reminder.timeZone);
	const minutes = (hhmm: string) =>
		Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
	const since = minutes(clock.time) - minutes(reminder.time);
	const late = since >= 0 ? since : since + 24 * 60;
	const day = since >= 0 ? clock.date : dayBefore(clock.date);

	return {
		isDue: reminder.lastSentOn !== day && late <= LATEST,
		today: day,
	};
}

/** The date-only day before `YYYY-MM-DD`. */
function dayBefore(date: string): string {
	const at = new Date(`${date}T00:00:00Z`);
	at.setUTCDate(at.getUTCDate() - 1);
	return at.toISOString().slice(0, 10);
}
