import { describe, expect, it } from "bun:test";
import * as v from "valibot";
import { isDue, localClock, setReminderInputSchema } from "./reminder";

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

	it("still goes out just after midnight, for the day it was set for", () => {
		const late = { time: "23:58", timeZone: "UTC" };

		expect(isDue(late, at("2026-09-26T00:03:00Z"))).toEqual({
			isDue: true,
			today: "2026-09-25",
		});
		// Sent for the 25th, so the 26th's own still goes out that night.
		expect(
			isDue({ ...late, lastSentOn: "2026-09-25" }, at("2026-09-26T23:59:00Z"))
				.isDue,
		).toBe(true);
	});
});

describe("setReminderInputSchema", () => {
	const input = { target: "tag", targetId: "tag_1", time: "08:00" };

	it("takes a real time zone and refuses an unknown one", () => {
		expect(
			v.safeParse(setReminderInputSchema, {
				...input,
				timeZone: "Asia/Kolkata",
			}).success,
		).toBe(true);
		expect(
			v.safeParse(setReminderInputSchema, { ...input, timeZone: "Etc/Unknown" })
				.success,
		).toBe(false);
	});
});
