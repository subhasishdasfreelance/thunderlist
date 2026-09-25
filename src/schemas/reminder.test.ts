import { describe, expect, it } from "bun:test";
import { isDue, localClock } from "./reminder";

describe("localClock", () => {
	it("reads the day and the minute on the person's own clock", () => {
		const now = new Date("2026-09-25T02:30:00Z");
		expect(localClock(now, "Asia/Kolkata")).toEqual({
			date: "2026-09-25",
			time: "08:00",
		});
		expect(localClock(now, "America/New_York")).toEqual({
			date: "2026-09-24",
			time: "22:30",
		});
	});
});

describe("isDue", () => {
	const at = (iso: string) => new Date(iso);
	const reminder = { time: "08:00", timeZone: "Asia/Kolkata" };

	it("is due once its time has come today", () => {
		expect(isDue(reminder, at("2026-09-25T02:35:00Z")).isDue).toBe(true);
		expect(isDue(reminder, at("2026-09-25T02:25:00Z")).isDue).toBe(false);
	});

	it("goes out once a day", () => {
		expect(
			isDue(
				{ ...reminder, lastSentOn: "2026-09-25" },
				at("2026-09-25T02:35:00Z"),
			).isDue,
		).toBe(false);
	});

	it("is not sent hours after its time", () => {
		expect(isDue(reminder, at("2026-09-25T08:00:00Z")).isDue).toBe(false);
	});
});
