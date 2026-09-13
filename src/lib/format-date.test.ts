import { describe, expect, it } from "bun:test";
import {
	formatClock,
	formatDate,
	formatDateWithWeekday,
	formatDeadline,
	formatSchedule,
} from "./format-date";

describe("formatDate", () => {
	it("writes a date the way the app shows it", () => {
		expect(formatDate("2026-10-08")).toBe("8th Oct, 2026");
	});

	it("uses the right ordinal", () => {
		expect(formatDate("2026-10-01")).toBe("1st Oct, 2026");
		expect(formatDate("2026-10-02")).toBe("2nd Oct, 2026");
		expect(formatDate("2026-10-03")).toBe("3rd Oct, 2026");
		expect(formatDate("2026-10-04")).toBe("4th Oct, 2026");
		expect(formatDate("2026-10-21")).toBe("21st Oct, 2026");
		expect(formatDate("2026-10-22")).toBe("22nd Oct, 2026");
		expect(formatDate("2026-10-23")).toBe("23rd Oct, 2026");
		expect(formatDate("2026-10-31")).toBe("31st Oct, 2026");
	});

	it("says 11th, 12th and 13th, not 11st, 12nd and 13rd", () => {
		expect(formatDate("2026-10-11")).toBe("11th Oct, 2026");
		expect(formatDate("2026-10-12")).toBe("12th Oct, 2026");
		expect(formatDate("2026-10-13")).toBe("13th Oct, 2026");
	});

	it("names every month", () => {
		expect(formatDate("2026-01-05")).toBe("5th Jan, 2026");
		expect(formatDate("2026-12-05")).toBe("5th Dec, 2026");
	});

	it("takes the date off the front of a timestamp", () => {
		expect(formatDate("2026-10-08T09:12:04.881Z")).toBe("8th Oct, 2026");
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

describe("formatDateWithWeekday", () => {
	it("puts the weekday in front", () => {
		expect(formatDateWithWeekday("2026-10-08")).toBe("Thursday, 8th Oct, 2026");
	});

	it("takes the weekday from the date, not from the local timezone", () => {
		expect(formatDateWithWeekday("2026-01-01")).toBe("Thursday, 1st Jan, 2026");
	});

	it("falls back to the plain format when there is no date to read", () => {
		expect(formatDateWithWeekday("nope")).toBe("nope");
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
			"8th Oct, 2026, 6:30 pm",
		);
	});

	it("is the day alone without one", () => {
		expect(formatDeadline("2026-10-08", null)).toBe("8th Oct, 2026");
	});
});

describe("formatSchedule", () => {
	it("says when something is due", () => {
		expect(
			formatSchedule({ deadline: "2026-10-08", deadlineTime: "09:00" }),
		).toBe("due 8th Oct, 2026, 9:00 am");
	});

	it("says which hours something repeats in", () => {
		expect(
			formatSchedule({
				deadline: null,
				dailyWindow: { from: "06:00", to: "22:00" },
			}),
		).toBe("daily 6:00 am – 10:00 pm");
	});

	it("says nothing for a schedule that asks for nothing", () => {
		expect(formatSchedule({ deadline: null })).toBeNull();
	});
});
