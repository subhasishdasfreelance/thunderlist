import { describe, expect, it } from "bun:test";
import type { ProgressEntry } from "#/schemas/tracker";
import {
	addDays,
	clampPercent,
	computeVelocity,
	daysBetween,
	deriveCurrentValue,
	elapsedFraction,
	paceStatus,
	sortEntriesOldestFirst,
	trackerProgress,
	withDeltas,
} from "./progress";

function entry(partial: Partial<ProgressEntry> & { entryId: string }) {
	return {
		recordedAt: "2026-09-01",
		value: 0,
		delta: 0,
		note: "",
		updatedAt: "2026-09-01T00:00:00.000Z",
		...partial,
	} satisfies ProgressEntry;
}

describe("clampPercent", () => {
	it("rounds and clamps to 0-100", () => {
		expect(clampPercent(68.9)).toBe(69);
		expect(clampPercent(-5)).toBe(0);
		expect(clampPercent(140)).toBe(100);
	});

	it("treats non-finite input as zero", () => {
		expect(clampPercent(Number.NaN)).toBe(0);
		expect(clampPercent(Number.POSITIVE_INFINITY)).toBe(0);
	});
});

describe("daysBetween", () => {
	it("counts whole calendar days", () => {
		expect(daysBetween("2026-09-01", "2026-09-11")).toBe(10);
		expect(daysBetween("2026-09-01", "2026-09-01")).toBe(0);
	});

	it("is negative when the second day is earlier", () => {
		expect(daysBetween("2026-09-11", "2026-09-01")).toBe(-10);
	});

	it("crosses a daylight-saving boundary without drifting", () => {
		// The UK clocks go back on 2026-10-25.
		expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
	});

	it("is null for anything that is not a date", () => {
		expect(daysBetween("", "2026-09-01")).toBeNull();
		expect(daysBetween("2026-09-01", "not-a-date")).toBeNull();
	});
});

describe("addDays", () => {
	it("moves a calendar day forwards", () => {
		expect(addDays("2026-09-01", 10)).toBe("2026-09-11");
	});

	it("rolls over a month boundary", () => {
		expect(addDays("2026-09-28", 5)).toBe("2026-10-03");
	});

	it("is null for an unparseable day", () => {
		expect(addDays("nope", 1)).toBeNull();
	});
});

describe("trackerProgress", () => {
	it("computes current over target", () => {
		expect(trackerProgress(284, 412)).toEqual({
			current: 284,
			target: 412,
			percent: 69,
		});
	});

	it("works for any unit, not just pages", () => {
		expect(trackerProgress(12, 20).percent).toBe(60);
		expect(trackerProgress(64, 100).percent).toBe(64);
	});

	it("avoids dividing by zero when no target is set", () => {
		expect(trackerProgress(10, 0).percent).toBe(0);
	});

	it("clamps a beaten goal to 100 for display", () => {
		expect(trackerProgress(120, 100).percent).toBe(100);
	});
});

describe("withDeltas", () => {
	it("derives each step from the reading before it", () => {
		const history = withDeltas([
			entry({ entryId: "ent_001", recordedAt: "2026-09-01", value: 45 }),
			entry({ entryId: "ent_002", recordedAt: "2026-09-08", value: 78 }),
		]);

		expect(history.map((row) => row.delta)).toEqual([45, 33]);
		expect(history.map((row) => row.value)).toEqual([45, 78]);
	});

	it("measures the first reading from zero", () => {
		expect(withDeltas([entry({ entryId: "ent_a", value: 45 })])[0].delta).toBe(
			45,
		);
	});

	it("re-spaces neighbours when a reading is back-dated between them", () => {
		const history = withDeltas([
			entry({ entryId: "ent_001", recordedAt: "2026-09-01", value: 45 }),
			entry({ entryId: "ent_003", recordedAt: "2026-09-08", value: 78 }),
			// Logged later, but for a day in between.
			entry({ entryId: "ent_002", recordedAt: "2026-09-04", value: 60 }),
		]);

		expect(history.map((row) => row.recordedAt)).toEqual([
			"2026-09-01",
			"2026-09-04",
			"2026-09-08",
		]);
		expect(history.map((row) => row.delta)).toEqual([45, 15, 18]);
	});

	it("records a negative step when progress goes backwards", () => {
		const history = withDeltas([
			entry({ entryId: "ent_a", recordedAt: "2026-09-01", value: 90 }),
			entry({ entryId: "ent_b", recordedAt: "2026-09-02", value: 40 }),
		]);

		expect(history[1].delta).toBe(-50);
	});

	it("corrects a stored delta that disagrees with the readings", () => {
		const history = withDeltas([
			entry({ entryId: "ent_a", value: 45, delta: 999 }),
		]);

		expect(history[0].delta).toBe(45);
	});

	it("does not mutate its input", () => {
		const entries = [entry({ entryId: "ent_a", value: 45, delta: 0 })];
		withDeltas(entries);

		expect(entries[0].delta).toBe(0);
	});
});

describe("deriveCurrentValue", () => {
	it("uses the latest reading rather than summing entries", () => {
		const entries = [
			entry({ entryId: "ent_001", recordedAt: "2026-09-01", value: 50 }),
			entry({ entryId: "ent_002", recordedAt: "2026-09-03", value: 82 }),
			entry({ entryId: "ent_003", recordedAt: "2026-09-05", value: 120 }),
		];

		expect(deriveCurrentValue(entries)).toBe(120);
	});

	it("ignores the order rows happen to sit in", () => {
		const entries = [
			entry({ entryId: "ent_003", recordedAt: "2026-09-05", value: 120 }),
			entry({ entryId: "ent_001", recordedAt: "2026-09-01", value: 50 }),
		];

		expect(deriveCurrentValue(entries)).toBe(120);
	});

	it("breaks same-day ties on the id, which is time-sortable", () => {
		const entries = [
			entry({ entryId: "ent_b", recordedAt: "2026-09-05", value: 20 }),
			entry({ entryId: "ent_a", recordedAt: "2026-09-05", value: 10 }),
		];

		expect(deriveCurrentValue(entries)).toBe(20);
	});

	it("is zero with no entries", () => {
		expect(deriveCurrentValue([])).toBe(0);
	});

	it("allows progress to go down", () => {
		const entries = [
			entry({ entryId: "ent_a", recordedAt: "2026-09-01", value: 90 }),
			entry({ entryId: "ent_b", recordedAt: "2026-09-02", value: 40 }),
		];

		expect(deriveCurrentValue(entries)).toBe(40);
	});
});

describe("sortEntriesOldestFirst", () => {
	it("does not mutate its input", () => {
		const entries = [
			entry({ entryId: "ent_b", recordedAt: "2026-09-05" }),
			entry({ entryId: "ent_a", recordedAt: "2026-09-01" }),
		];

		sortEntriesOldestFirst(entries);

		expect(entries[0].entryId).toBe("ent_b");
	});
});

describe("elapsedFraction", () => {
	it("is the share of the window that has gone", () => {
		expect(
			elapsedFraction({
				startDate: "2026-09-01",
				deadline: "2026-09-11",
				today: "2026-09-06",
			}),
		).toBe(0.5);
	});

	it("clamps once the deadline has passed", () => {
		expect(
			elapsedFraction({
				startDate: "2026-09-01",
				deadline: "2026-09-11",
				today: "2026-10-01",
			}),
		).toBe(1);
	});

	it("is null without a deadline to measure against", () => {
		expect(
			elapsedFraction({
				startDate: "2026-09-01",
				deadline: null,
				today: "2026-09-06",
			}),
		).toBeNull();
	});
});

describe("paceStatus", () => {
	const startDate = "2026-09-01";
	const deadline = "2026-09-11"; // a ten day window
	const halfway = "2026-09-06";

	it("is on track when progress matches elapsed time", () => {
		expect(
			paceStatus({
				startDate,
				deadline,
				fractionComplete: 0.5,
				today: halfway,
			}),
		).toBe("on_track");
	});

	it("is ahead when progress outruns elapsed time", () => {
		expect(
			paceStatus({
				startDate,
				deadline,
				fractionComplete: 0.9,
				today: halfway,
			}),
		).toBe("ahead");
	});

	it("is behind when progress lags elapsed time", () => {
		expect(
			paceStatus({
				startDate,
				deadline,
				fractionComplete: 0.1,
				today: halfway,
			}),
		).toBe("behind");
	});

	it("tolerates small drift rather than flickering", () => {
		expect(
			paceStatus({
				startDate,
				deadline,
				fractionComplete: 0.56,
				today: halfway,
			}),
		).toBe("on_track");
	});

	it("paces from a back-dated start rather than from today", () => {
		// Started a month before it was entered: half the window is already gone.
		expect(
			paceStatus({
				startDate: "2026-08-01",
				deadline: "2026-10-01",
				fractionComplete: 0.5,
				today: "2026-09-01",
			}),
		).toBe("on_track");
	});

	it("returns null with no deadline instead of inventing a status", () => {
		expect(
			paceStatus({
				startDate,
				deadline: null,
				fractionComplete: 0.5,
				today: halfway,
			}),
		).toBeNull();
	});

	it("returns null when the dates cannot support a judgement", () => {
		expect(
			paceStatus({
				startDate: "",
				deadline,
				fractionComplete: 0.5,
				today: halfway,
			}),
		).toBeNull();

		expect(
			paceStatus({
				startDate,
				deadline: "2026-08-01",
				fractionComplete: 0.5,
				today: halfway,
			}),
		).toBeNull();

		expect(
			paceStatus({
				startDate,
				deadline: "not-a-date",
				fractionComplete: 0.5,
				today: halfway,
			}),
		).toBeNull();
	});

	it("counts finished work as ahead when the deadline has not arrived", () => {
		expect(
			paceStatus({ startDate, deadline, fractionComplete: 1, today: halfway }),
		).toBe("ahead");
	});

	it("counts unfinished work as behind once the deadline passes", () => {
		expect(
			paceStatus({
				startDate,
				deadline,
				fractionComplete: 0.4,
				today: "2026-10-01",
			}),
		).toBe("behind");
	});
});

describe("computeVelocity", () => {
	it("reports the pace achieved so far", () => {
		const velocity = computeVelocity({
			startDate: "2026-09-01",
			deadline: "2026-09-21",
			current: 100,
			target: 400,
			today: "2026-09-11",
		});

		expect(velocity.daysElapsed).toBe(10);
		expect(velocity.perDay).toBe(10);
	});

	it("projects when the target is reached at that pace", () => {
		// 300 left at 10/day lands 30 days after today.
		expect(
			computeVelocity({
				startDate: "2026-09-01",
				deadline: null,
				current: 100,
				target: 400,
				today: "2026-09-11",
			}).projectedFinish,
		).toBe("2026-10-11");
	});

	it("says what pace the deadline actually needs", () => {
		// 300 left over the 10 days to the deadline.
		expect(
			computeVelocity({
				startDate: "2026-09-01",
				deadline: "2026-09-21",
				current: 100,
				target: 400,
				today: "2026-09-11",
			}).requiredPerDay,
		).toBe(30);
	});

	it("counts day one as a whole day rather than dividing by zero", () => {
		const velocity = computeVelocity({
			startDate: "2026-09-01",
			deadline: null,
			current: 30,
			target: 400,
			today: "2026-09-01",
		});

		expect(velocity.daysElapsed).toBe(0);
		expect(velocity.perDay).toBe(30);
	});

	it("does not project a finish for something that is not moving", () => {
		expect(
			computeVelocity({
				startDate: "2026-09-01",
				deadline: null,
				current: 0,
				target: 400,
				today: "2026-09-11",
			}).projectedFinish,
		).toBeNull();
	});

	it("asks for nothing more once the target is met", () => {
		const velocity = computeVelocity({
			startDate: "2026-09-01",
			deadline: "2026-09-21",
			current: 400,
			target: 400,
			today: "2026-09-11",
		});

		expect(velocity.requiredPerDay).toBe(0);
		expect(velocity.projectedFinish).toBeNull();
	});

	it("collapses a passed deadline onto today rather than dividing by zero", () => {
		expect(
			computeVelocity({
				startDate: "2026-09-01",
				deadline: "2026-09-05",
				current: 100,
				target: 400,
				today: "2026-09-11",
			}).requiredPerDay,
		).toBe(300);
	});

	it("has no required pace without a deadline", () => {
		const velocity = computeVelocity({
			startDate: "2026-09-01",
			deadline: null,
			current: 100,
			target: 400,
			today: "2026-09-11",
		});

		expect(velocity.requiredPerDay).toBeNull();
		expect(velocity.daysRemaining).toBeNull();
	});
});

describe("trackerProgress with a starting value", () => {
	// Page 40 of a book being read to page 80: halfway is page 60, not page 60
	// out of 80. The readings shown stay the real ones.
	it("measures across the distance still to cover", () => {
		expect(trackerProgress(60, 80, 40)).toEqual({
			current: 60,
			target: 80,
			percent: 50,
		});
	});

	it("is at nothing on the day it starts", () => {
		expect(trackerProgress(40, 80, 40).percent).toBe(0);
	});

	it("is finished at the target", () => {
		expect(trackerProgress(80, 80, 40).percent).toBe(100);
	});

	it("does not run backwards below where it started", () => {
		expect(trackerProgress(30, 80, 40).percent).toBe(0);
	});

	it("still behaves as before without one", () => {
		expect(trackerProgress(284, 412).percent).toBe(
			trackerProgress(284, 412, 0).percent,
		);
	});
});

describe("computeVelocity with a starting value", () => {
	// Page 40 to page 80 in five days is eight pages a day, not sixteen.
	const plan = {
		startDate: "2026-01-01",
		deadline: "2026-01-06",
		start: 40,
		target: 80,
	};

	it("expects the distance, not the reading", () => {
		const velocity = computeVelocity({
			...plan,
			current: 40,
			today: "2026-01-01",
		});

		expect(velocity.expectedPerDay).toBe(8);
	});

	it("counts only the pages actually turned", () => {
		const velocity = computeVelocity({
			...plan,
			current: 49,
			today: "2026-01-02",
		});

		// Nine pages in one day, not forty-nine.
		expect(velocity.perDay).toBe(9);
	});
});
