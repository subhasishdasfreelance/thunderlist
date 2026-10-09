import { describe, expect, it } from "bun:test";
import { formatFinish } from "./day-pace";

// Friday, Oct 9, 2026, 4:00 pm on the viewer's clock.
const now = new Date(2026, 9, 9, 16, 0);

describe("formatFinish", () => {
	it("gives only the time for later today", () => {
		expect(formatFinish(new Date(2026, 9, 9, 21, 40), now)).toBe("9:40 pm");
	});

	it("says tomorrow for tomorrow", () => {
		expect(formatFinish(new Date(2026, 9, 10, 17, 0), now)).toBe(
			"Tomorrow, 5:00 pm",
		);
	});

	it("names the weekday within the week", () => {
		expect(formatFinish(new Date(2026, 9, 11, 3, 0), now)).toBe(
			"Sunday, 3:00 am",
		);
		expect(formatFinish(new Date(2026, 9, 15, 14, 0), now)).toBe(
			"Thursday, 2:00 pm",
		);
	});

	it("gives the date alone beyond the week", () => {
		expect(formatFinish(new Date(2026, 9, 22, 9, 0), now)).toBe("Thu, Oct 22");
	});

	it("adds the year only when it is not this one", () => {
		expect(formatFinish(new Date(2027, 0, 7, 9, 0), now)).toBe(
			"Thu, Jan 7, 2027",
		);
	});
});
