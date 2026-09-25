import * as v from "valibot";
import { idSchema, timeOfDaySchema } from "./common";

/**
 * A daily notification, to one person, at a time of their day.
 *
 * `day` is the one about everything — "time to review your day", set on the
 * Settings screen and the same in every space. The rest are about one
 * checklist, tracker or tag, set from its edit dialog, and belong to the
 * space it is in.
 *
 * Each is the person's own: a reminder on a team's checklist reminds whoever
 * set it, not the team.
 */
export const REMINDER_TARGETS = ["day", "checklist", "tracker", "tag"] as const;

export type ReminderTarget = (typeof REMINDER_TARGETS)[number];

export type Reminder = {
	target: ReminderTarget;
	/** The checklist, tracker or tag; `null` for the day's. */
	targetId: string | null;
	/** `HH:MM` on the person's own clock. */
	time: string;
};

/**
 * Set a reminder, change its time, or — with `time: null` — take it away.
 *
 * `timeZone` is the browser's, so "08:00" is eight in the morning wherever
 * the person is when they set it.
 */
export const setReminderInputSchema = v.pipe(
	v.object({
		target: v.picklist(REMINDER_TARGETS),
		targetId: v.nullable(idSchema),
		time: v.nullable(timeOfDaySchema),
		timeZone: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
	}),
	v.check(
		(input) => (input.target === "day") === (input.targetId === null),
		"A reminder is about the day, or about one thing",
	),
);

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
 * Whether a reminder is due: its time has come today on its own clock, it has
 * not gone out today, and it is not so late that it would only be noise.
 */
export function isDue(
	reminder: { time: string; timeZone: string; lastSentOn?: string | null },
	now: Date,
): { isDue: boolean; today: string } {
	const clock = localClock(now, reminder.timeZone);
	const minutes = (hhmm: string) =>
		Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
	const late = minutes(clock.time) - minutes(reminder.time);

	return {
		isDue: reminder.lastSentOn !== clock.date && late >= 0 && late <= LATEST,
		today: clock.date,
	};
}
