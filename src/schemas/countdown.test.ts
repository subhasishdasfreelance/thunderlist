import { describe, expect, it } from "bun:test";
import { countdownParts } from "./countdown";

/** 28th Sep 2026, 20:00:00 on the local clock. */
const NOW = new Date(2026, 8, 28, 20, 0, 0).getTime();

const read = (parts: ReturnType<typeof countdownParts>) =>
	parts.map((part) => `${part.value} ${part.unit}`).join(", ");

describe("countdownParts", () => {
	it("counts down to the second, to the day's midnight", () => {
		expect(read(countdownParts("2027-11-30", NOW, "seconds"))).toBe(
			"1 years, 2 months, 1 days, 4 hours, 0 minutes, 0 seconds",
		);
	});

	it("leaves out the leading units that are 0", () => {
		expect(read(countdownParts("2026-09-29", NOW, "seconds"))).toBe(
			"4 hours, 0 minutes, 0 seconds",
		);
		expect(read(countdownParts("2026-10-05", NOW, "calendar"))).toBe("7 days");
	});

	it("counts calendar months and days from today", () => {
		expect(read(countdownParts("2026-12-31", NOW, "calendar"))).toBe(
			"3 months, 3 days",
		);
	});

	it("counts weeks, or days alone", () => {
		expect(read(countdownParts("2026-12-31", NOW, "weeks"))).toBe(
			"13 weeks, 3 days",
		);
		expect(read(countdownParts("2026-12-31", NOW, "days"))).toBe("94 days");
	});

	it("counts up once the day has passed", () => {
		expect(read(countdownParts("2026-09-20", NOW, "calendar"))).toBe("8 days");
		expect(read(countdownParts("2026-09-27", NOW, "seconds"))).toBe(
			"1 days, 20 hours, 0 minutes, 0 seconds",
		);
	});

	it("has nothing to count on the day itself", () => {
		expect(countdownParts("2026-09-28", NOW, "seconds")).toEqual([]);
	});

	it("counts to the second to a time on the day", () => {
		expect(read(countdownParts("2026-09-29", NOW, "seconds", "18:30"))).toBe(
			"22 hours, 30 minutes, 0 seconds",
		);
		expect(read(countdownParts("2026-09-27", NOW, "seconds", "18:30"))).toBe(
			"1 days, 1 hours, 30 minutes, 0 seconds",
		);
	});

	it("counts the hours left on the day until its time has come", () => {
		expect(read(countdownParts("2026-09-28", NOW, "seconds", "21:15"))).toBe(
			"1 hours, 15 minutes, 0 seconds",
		);
		expect(countdownParts("2026-09-28", NOW, "seconds", "19:00")).toEqual([]);
	});

	it("counts whole days alike with a time or without", () => {
		expect(read(countdownParts("2026-12-31", NOW, "calendar", "18:30"))).toBe(
			"3 months, 3 days",
		);
		expect(countdownParts("2026-09-28", NOW, "days", "21:15")).toEqual([]);
	});
});
