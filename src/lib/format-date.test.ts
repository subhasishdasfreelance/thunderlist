import { describe, expect, it } from "bun:test";
import {
	formatClock,
	formatDate,
	formatDeadline,
	formatDue,
	formatSchedule,
} from "./format-date";

describe("formatDate", () => {
	it("takes the weekday from the date, not from the local timezone", () => {
		expect(formatDate("2026-01-01")).toBe("Thu, Jan 1, 2026");
		expect(formatDate("2026-09-30")).toBe("Wed, Sep 30, 2026");
	});

	it("writes a date the way the app shows it", () => {
		expect(formatDate("2026-10-08")).toBe("Thu, Oct 8, 2026");
	});

	it("writes the day as a plain number", () => {
		expect(formatDate("2026-10-01")).toBe("Thu, Oct 1, 2026");
		expect(formatDate("2026-10-02")).toBe("Fri, Oct 2, 2026");
		expect(formatDate("2026-10-03")).toBe("Sat, Oct 3, 2026");
		expect(formatDate("2026-10-04")).toBe("Sun, Oct 4, 2026");
		expect(formatDate("2026-10-21")).toBe("Wed, Oct 21, 2026");
		expect(formatDate("2026-10-22")).toBe("Thu, Oct 22, 2026");
		expect(formatDate("2026-10-23")).toBe("Fri, Oct 23, 2026");
		expect(formatDate("2026-10-31")).toBe("Sat, Oct 31, 2026");
	});

	it("names every month", () => {
		expect(formatDate("2026-01-05")).toBe("Mon, Jan 5, 2026");
		expect(formatDate("2026-12-05")).toBe("Sat, Dec 5, 2026");
	});

	it("takes the date off the front of a timestamp", () => {
		expect(formatDate("2026-10-08T09:12:04.881Z")).toBe("Thu, Oct 8, 2026");
	});

	it("is empty for a missing date rather than showing a placeholder", () => {
		expect(formatDate(null)).toBe("");
		expect(formatDate(undefined)).toBe("");
		expect(formatDate("")).toBe("");
	});

	it("hands back anything that is not a date rather than showing Invalid Date", () => {
		expect(formatDate("next Tuesday")).toBe("next Tuesday");
		expect(formatDate("2026-13-01")).toBe("2026-13-01");
	});
});

describe("formatClock", () => {
	it("writes a time the way the app shows it", () => {
		expect(formatClock("18:30")).toBe("6:30 pm");
		expect(formatClock("06:00")).toBe("6:00 am");
	});

	it("calls midnight and noon twelve", () => {
		expect(formatClock("00:15")).toBe("12:15 am");
		expect(formatClock("12:00")).toBe("12:00 pm");
	});

	it("hands back anything that is not a time", () => {
		expect(formatClock("teatime")).toBe("teatime");
	});
});

describe("formatDeadline", () => {
	it("adds the time after the day", () => {
		expect(formatDeadline("2026-10-08", "18:30")).toBe(
			"Thu, Oct 8, 2026, 6:30 pm",
		);
	});

	it("is the day alone without one", () => {
		expect(formatDeadline("2026-10-08", null)).toBe("Thu, Oct 8, 2026");
	});
});

describe("formatDue", () => {
	const today = "2026-09-30";

	it("counts the days left", () => {
		expect(formatDue("2026-10-03", today)).toBe("Due in 3 days");
		expect(formatDue("2027-09-30", today)).toBe("Due in 365 days");
	});

	it("names today, tomorrow and yesterday", () => {
		expect(formatDue("2026-09-30", today)).toBe("Due today");
		expect(formatDue("2026-10-01", today)).toBe("Due tomorrow");
		expect(formatDue("2026-09-29", today)).toBe("Due yesterday");
	});

	it("says how long ago one passed", () => {
		expect(formatDue("2026-09-27", today)).toBe("Overdue by 3 days");
	});

	it("hands back anything that is not a date", () => {
		expect(formatDue("soon", today)).toBe("Due soon");
	});
});

describe("formatSchedule", () => {
	it("says when something is due", () => {
		expect(
			formatSchedule({ deadline: "2026-10-08", deadlineTime: "09:00" }),
		).toBe("Due Thu, Oct 8, 2026, 9:00 am");
	});

	it("says which hours something repeats in", () => {
		expect(
			formatSchedule({
				deadline: null,
				dailyWindow: { from: "06:00", to: "22:00" },
			}),
		).toBe("Daily 6:00 am – 10:00 pm");
	});

	it("says nothing for a schedule that asks for nothing", () => {
		expect(formatSchedule({ deadline: null })).toBeNull();
	});
});
