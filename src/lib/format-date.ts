/**
 * How dates are written on screen.
 *
 * One format, everywhere: `8th Oct, 2026`. Dates are stored as `YYYY-MM-DD`,
 * which is right for storage and wrong for reading, and a date that is
 * written one way on a card and another way in a dialog makes the two look like
 * different things.
 *
 * The month names and the ordinal are English rather than locale-driven, because
 * the format was chosen deliberately. That also makes it identical on the server
 * and in the browser, so a formatted date never causes a hydration mismatch.
 */

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

const WEEKDAYS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `1st`, `2nd`, `3rd`, `4th` … including the 11th-13th exceptions. */
function ordinal(day: number): string {
	const teens = day % 100;
	if (teens >= 11 && teens <= 13) return `${day}th`;

	switch (day % 10) {
		case 1:
			return `${day}st`;
		case 2:
			return `${day}nd`;
		case 3:
			return `${day}rd`;
		default:
			return `${day}th`;
	}
}

function parts(value: string): { y: number; m: number; d: number } | null {
	const match = DATE_ONLY.exec(value.slice(0, 10));
	if (!match) return null;

	const y = Number(match[1]);
	const m = Number(match[2]);
	const d = Number(match[3]);
	if (m < 1 || m > 12 || d < 1 || d > 31) return null;

	return { y, m, d };
}

/**
 * `2026-10-08` → `8th Oct, 2026`.
 *
 * Anything that is not a date is handed back untouched: showing what the value
 * actually is beats showing "Invalid Date".
 */
export function formatDate(value: string | null | undefined): string {
	if (!value) return "";

	const parsed = parts(value);
	return parsed === null
		? value
		: `${ordinal(parsed.d)} ${MONTHS[parsed.m - 1]}, ${parsed.y}`;
}

/** `2026-10-08` → `Thursday, 8th Oct, 2026`. Used for the Today heading. */
export function formatDateWithWeekday(value: string): string {
	const parsed = parts(value);
	if (parsed === null) return formatDate(value);

	// Built in UTC so the weekday comes from the date itself rather than from
	// whichever timezone happens to be running the code.
	const weekday =
		WEEKDAYS[new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).getUTCDay()];

	return `${weekday}, ${formatDate(value)}`;
}

/**
 * `18:30` → `6:30 pm`.
 *
 * A time is stored the way a date is — plainly, on the viewer's own clock — and
 * written in English the way a date is, so it reads the same on the server and
 * in the browser.
 */
export function formatClock(time: string): string {
	const match = /^(\d{2}):(\d{2})$/.exec(time);
	if (!match) return time;

	const hours = Number(match[1]);
	const hour = hours % 12 === 0 ? 12 : hours % 12;

	return `${hour}:${match[2]} ${hours < 12 ? "am" : "pm"}`;
}

/** `2026-10-08` at `18:30` → `8th Oct, 2026, 6:30 pm`; the day alone without one. */
export function formatDeadline(date: string, time?: string | null): string {
	return time ? `${formatDate(date)}, ${formatClock(time)}` : formatDate(date);
}

/** `06:00` to `22:00` → `6:00 am – 10:00 pm`. */
export function formatWindow(window: { from: string; to: string }): string {
	return `${formatClock(window.from)} – ${formatClock(window.to)}`;
}

/**
 * What a schedule asks for, in a few words: `due 8th Oct, 2026, 6:30 pm`, or
 * `daily 6:00 am – 10:00 pm`. `null` for one that asks for nothing.
 */
export function formatSchedule(schedule: {
	deadline: string | null;
	deadlineTime?: string | null;
	dailyWindow?: { from: string; to: string } | null;
}): string | null {
	if (schedule.dailyWindow)
		return `daily ${formatWindow(schedule.dailyWindow)}`;
	if (schedule.deadline) {
		return `due ${formatDeadline(schedule.deadline, schedule.deadlineTime)}`;
	}
	return null;
}
