import * as chrono from "chrono-node";
import { todayDateOnly } from "#/schemas/common";

/**
 * A deadline written into a line as it is added: "pay rent -deadline 3rd Aug
 * 26, 2AM", "call Sam -deadline tomorrow 5pm #work".
 *
 * Everything after `-deadline` is read as a date, in plain words, for as far as
 * it reads as one; the rest of the line stays as typed, so tags and a `-u`
 * after it still count. Numbers are read day first — 3/8 is the 3rd of August
 * — and a day with no year is the next one to come. A `-deadline` whose words
 * are not a date is left in the title, where it shows it was not understood.
 *
 * Pure but for the clock it is handed.
 */

/** Only after a space, so a word with "-deadline" in it stays a word. */
const DEADLINE_MARK = /(?:^|\s)-deadline\s+/i;

export type InlineDeadline = {
	/** The line with the deadline taken out. */
	title: string;
	/** `YYYY-MM-DD`, or `null` for none; see `Task.deadline`. */
	deadline: string | null;
	/** `HH:MM`, or `null` when no time was written; see `Task.deadlineTime`. */
	deadlineTime: string | null;
};

export function readDeadline(line: string, now: Date): InlineDeadline {
	const none = { title: line, deadline: null, deadlineTime: null };
	const mark = DEADLINE_MARK.exec(line);
	if (mark === null) return none;

	const from = mark.index + mark[0].length;
	const [found] = chrono.en.GB.parse(line.slice(from), now, {
		forwardDate: true,
	});
	if (found === undefined || found.index !== 0) return none;

	const when = found.start.date();
	return {
		title:
			`${line.slice(0, mark.index)}${line.slice(from + found.text.length)}`.trim(),
		deadline: todayDateOnly(when),
		deadlineTime: found.start.isCertain("hour")
			? `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`
			: null,
	};
}
