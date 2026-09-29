/**
 * How dates are written on screen.
 *
 * One format, everywhere: `Thu, Oct 8, 2026`. Dates are stored as `YYYY-MM-DD`,
 * which is right for storage and wrong for reading, and a date that is
 * written one way on a card and another way in a dialog makes the two look like
 * different things.
 *
 * The weekday and month names are English rather than locale-driven, because
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

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
 * `2026-10-08` → `Thu, Oct 8, 2026`.
 *
 * Anything that is not a date is handed back untouched: showing what the value
 * actually is beats showing "Invalid Date".
 */
export function formatDate(value: string | null | undefined): string {
	if (!value) return "";

	const parsed = parts(value);
	if (parsed === null) return value;

	// Built in UTC so the weekday comes from the date itself rather than from
	// whichever timezone happens to be running the code.
	const weekday =
		WEEKDAYS[new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).getUTCDay()];

	return `${weekday}, ${MONTHS[parsed.m - 1]} ${parsed.d}, ${parsed.y}`;
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

/** `2026-10-08` at `18:30` → `Thu, Oct 8, 2026, 6:30 pm`; the day alone without one. */
export function formatDeadline(date: string, time?: string | null): string {
	return time ? `${formatDate(date)}, ${formatClock(time)}` : formatDate(date);
}

/** `06:00` to `22:00` → `6:00 am – 10:00 pm`. */
function formatWindow(window: { from: string; to: string }): string {
	return `${formatClock(window.from)} – ${formatClock(window.to)}`;
}

/**
 * What a schedule asks for, in a few words: `Due Thu, Oct 8, 2026, 6:30 pm`, or
 * `Daily 6:00 am – 10:00 pm`. `null` for one that asks for nothing.
 */
export function formatSchedule(schedule: {
	deadline: string | null;
	deadlineTime?: string | null;
	dailyWindow?: { from: string; to: string } | null;
}): string | null {
	if (schedule.dailyWindow)
		return `Daily ${formatWindow(schedule.dailyWindow)}`;
	if (schedule.deadline) {
		return `Due ${formatDeadline(schedule.deadline, schedule.deadlineTime)}`;
	}
	return null;
}
