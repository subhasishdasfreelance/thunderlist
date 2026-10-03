import { describe, expect, test } from "bun:test";
import { readDeadline } from "./inline-deadline";

// Saturday, 3 October 2026, noon.
const now = new Date(2026, 9, 3, 12, 0);

describe("readDeadline", () => {
	test("reads a day, a two-digit year and a time", () => {
		expect(readDeadline("pay rent -deadline 3rd Aug 26, 2AM", now)).toEqual({
			title: "pay rent",
			deadline: "2026-08-03",
			deadlineTime: "02:00",
		});
	});

	test("a day with no time has no time", () => {
		expect(readDeadline("call Sam -deadline tomorrow", now)).toEqual({
			title: "call Sam",
			deadline: "2026-10-04",
			deadlineTime: null,
		});
	});

	test("leaves what follows the date in the line", () => {
		expect(
			readDeadline("call Sam -deadline tomorrow 5pm #work -u", now),
		).toEqual({
			title: "call Sam #work -u",
			deadline: "2026-10-04",
			deadlineTime: "17:00",
		});
	});

	test("a day with no year is the next one to come", () => {
		expect(readDeadline("renew -deadline 3 Aug", now).deadline).toBe(
			"2027-08-03",
		);
	});

	test("numbers are read day first", () => {
		expect(readDeadline("renew -deadline 3/8/2027", now).deadline).toBe(
			"2027-08-03",
		);
	});

	test("words that are not a date stay in the title", () => {
		expect(readDeadline("ship it -deadline someday", now)).toEqual({
			title: "ship it -deadline someday",
			deadline: null,
			deadlineTime: null,
		});
	});

	test("only a mark after a space counts", () => {
		expect(readDeadline("re-deadline tomorrow", now).deadline).toBeNull();
	});
});
