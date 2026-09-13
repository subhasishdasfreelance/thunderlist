import { describe, expect, it } from "bun:test";
import type { ProgressEntry } from "#/schemas/tracker";
import {
	clampPercent,
	compareBehind,
	computeVelocity,
	deriveCurrentValue,
	elapsedFraction,
	isOverdue,
	paceStatus,
	reachedTargetOn,
	sortEntriesOldestFirst,
	trackerFraction,
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

describe("reachedTargetOn", () => {
	it("is null until a reading reaches the target", () => {
		const entries = [
			entry({ entryId: "ent_a", recordedAt: "2026-09-01", value: 50 }),
			entry({ entryId: "ent_b", recordedAt: "2026-09-03", value: 99 }),
		];

		expect(reachedTargetOn(entries, 100)).toBeNull();
	});

	it("is the day the target was reached", () => {
		const entries = [
			entry({ entryId: "ent_c", recordedAt: "2026-09-05", value: 120 }),
			entry({ entryId: "ent_a", recordedAt: "2026-09-01", value: 50 }),
			entry({ entryId: "ent_b", recordedAt: "2026-09-03", value: 100 }),
		];

		expect(reachedTargetOn(entries, 100)).toBe("2026-09-03");
	});

	it("starts again after slipping back below it", () => {
		const entries = [
			entry({ entryId: "ent_a", recordedAt: "2026-09-01", value: 100 }),
			entry({ entryId: "ent_b", recordedAt: "2026-09-02", value: 80 }),
			entry({ entryId: "ent_c", recordedAt: "2026-09-04", value: 100 }),
		];

		expect(reachedTargetOn(entries, 100)).toBe("2026-09-04");
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
	// On the local clock, which is what the app paces by. July, so that no
	// daylight-saving change falls inside any window here.
	const at = (day: number, hours = 0, minutes = 0) =>
		new Date(2026, 6, day, hours, minutes).getTime();
	const daily = { from: "06:00", to: "22:00" };

	it("is the share of the window that has gone", () => {
		expect(
			elapsedFraction({
				startDate: "2026-07-01",
				deadline: "2026-07-11",
				now: at(6),
			}),
		).toBe(0.5);
	});

	it("moves through the day rather than once at midnight", () => {
		// Five and a half days of ten.
		expect(
			elapsedFraction({
				startDate: "2026-07-01",
				deadline: "2026-07-11",
				now: at(6, 12),
			}),
		).toBe(0.55);
	});

	it("counts fractional hours rather than whole ones", () => {
		// Four and a half hours of a nine-hour window: half, not four ninths.
		expect(
			elapsedFraction({
				startDate: "2026-07-06",
				deadline: "2026-07-06",
				deadlineTime: "09:00",
				now: at(6, 4, 30),
			}),
		).toBe(0.5);
	});

	it("runs to the deadline's time when it has one", () => {
		// Ten and a half days, of which five days and six hours have gone.
		expect(
			elapsedFraction({
				startDate: "2026-07-01",
				deadline: "2026-07-11",
				deadlineTime: "12:00",
				now: at(6, 6),
			}),
		).toBe(0.5);
	});

	it("measures something paced daily against today's hours", () => {
		// 06:00 to 22:00 is sixteen hours, and by two in the afternoon eight have
		// gone — whatever the start date.
		expect(
			elapsedFraction({
				startDate: "2026-07-01",
				deadline: null,
				dailyWindow: daily,
				now: at(6, 14),
			}),
		).toBe(0.5);
	});

	it("starts the daily window afresh each day", () => {
		const input = {
			startDate: "2026-07-01",
			deadline: null,
			dailyWindow: daily,
		};

		expect(elapsedFraction({ ...input, now: at(7, 5) })).toBe(0);
		expect(elapsedFraction({ ...input, now: at(7, 23) })).toBe(1);
	});

	it("clamps once the deadline has passed", () => {
		expect(
			elapsedFraction({
				startDate: "2026-07-01",
				deadline: "2026-07-11",
				now: at(31),
			}),
		).toBe(1);
	});

	it("is null without a deadline to measure against", () => {
		expect(
			elapsedFraction({
				startDate: "2026-07-01",
				deadline: null,
				now: at(6),
			}),
		).toBeNull();
	});

	it("is null for a daily window that does not end after it starts", () => {
		expect(
			elapsedFraction({
				startDate: "2026-07-01",
				deadline: null,
				dailyWindow: { from: "22:00", to: "06:00" },
				now: at(6, 12),
			}),
		).toBeNull();
	});
});

describe("compareBehind", () => {
	// On the local clock, which is what the app paces by.
	const now = new Date(2026, 8, 6).getTime();
	const due = (deadline: string, fractionComplete: number) => ({
		startDate: "2026-09-01",
		deadline,
		now,
		fractionComplete,
	});

	it("puts anything overdue first, even when it owes less of the whole", () => {
		const overdue = due("2026-09-05", 0.9);
		const untouched = due("2026-09-11", 0);

		expect([untouched, overdue].sort(compareBehind)).toEqual([
			overdue,
			untouched,
		]);
	});

	it("orders the rest by how much of the work is owed", () => {
		const behind = due("2026-09-11", 0.1);
		const ahead = due("2026-09-11", 0.9);

		expect([ahead, behind].sort(compareBehind)).toEqual([behind, ahead]);
	});

	it("never counts finished work as overdue", () => {
		expect(isOverdue(due("2026-09-05", 1))).toBe(false);
		expect(isOverdue(due("2026-09-05", 0.5))).toBe(true);
	});
});

describe("paceStatus", () => {
	const startDate = "2026-09-01";
	const deadline = "2026-09-11"; // a ten day window
	// On the local clock, which is what the app paces by.
	const halfway = new Date(2026, 8, 6).getTime();

	it("is on track when progress matches elapsed time", () => {
		expect(
			paceStatus({
				startDate,
				deadline,
				fractionComplete: 0.5,
				now: halfway,
			}),
		).toBe("on_track");
	});

	it("is ahead when progress outruns elapsed time", () => {
		expect(
			paceStatus({
				startDate,
				deadline,
				fractionComplete: 0.9,
				now: halfway,
			}),
		).toBe("ahead");
	});

	it("is behind when progress lags elapsed time", () => {
		expect(
			paceStatus({
				startDate,
				deadline,
				fractionComplete: 0.1,
				now: halfway,
			}),
		).toBe("behind");
	});

	it("tolerates a drift of up to one point either way", () => {
		expect(
			paceStatus({
				startDate,
				deadline,
				fractionComplete: 0.505,
				now: halfway,
			}),
		).toBe("on_track");

		expect(
			paceStatus({
				startDate,
				deadline,
				fractionComplete: 0.495,
				now: halfway,
			}),
		).toBe("on_track");
	});

	it("stops calling it on track past one point either way", () => {
		// Two points out, which at the old five-point tolerance read as on track.
		expect(
			paceStatus({
				startDate,
				deadline,
				fractionComplete: 0.52,
				now: halfway,
			}),
		).toBe("ahead");

		expect(
			paceStatus({
				startDate,
				deadline,
				fractionComplete: 0.48,
				now: halfway,
			}),
		).toBe("behind");
	});

	it("paces from a back-dated start rather than from today", () => {
		// Started a month before it was entered: half the window is already gone.
		expect(
			paceStatus({
				startDate: "2026-08-01",
				deadline: "2026-10-01",
				fractionComplete: 0.5,
				now: new Date(2026, 8, 1).getTime(),
			}),
		).toBe("on_track");
	});

	it("returns null with no deadline instead of inventing a status", () => {
		expect(
			paceStatus({
				startDate,
				deadline: null,
				fractionComplete: 0.5,
				now: halfway,
			}),
		).toBeNull();
	});

	it("returns null when the dates cannot support a judgement", () => {
		expect(
			paceStatus({
				startDate: "",
				deadline,
				fractionComplete: 0.5,
				now: halfway,
			}),
		).toBeNull();

		expect(
			paceStatus({
				startDate,
				deadline: "2026-08-01",
				fractionComplete: 0.5,
				now: halfway,
			}),
		).toBeNull();

		expect(
			paceStatus({
				startDate,
				deadline: "not-a-date",
				fractionComplete: 0.5,
				now: halfway,
			}),
		).toBeNull();
	});

	it("counts finished work as ahead when the deadline has not arrived", () => {
		expect(
			paceStatus({ startDate, deadline, fractionComplete: 1, now: halfway }),
		).toBe("ahead");
	});

	it("counts unfinished work as behind once the deadline passes", () => {
		expect(
			paceStatus({
				startDate,
				deadline,
				fractionComplete: 0.4,
				now: new Date(2026, 9, 1).getTime(),
			}),
		).toBe("behind");
	});
});

describe("computeVelocity", () => {
	// On the local clock, which is what the app paces by. September, so that no
	// daylight-saving change falls inside any window here.
	const at = (month: number, day: number, hours = 0, minutes = 0) =>
		new Date(2026, month - 1, day, hours, minutes).getTime();

	it("reports the pace achieved so far", () => {
		const velocity = computeVelocity({
			startDate: "2026-09-01",
			deadline: "2026-09-21",
			current: 100,
			target: 400,
			now: at(9, 11),
		});

		expect(velocity.minutesElapsed).toBe(10 * 1440);
		expect(velocity.perDay).toBe(10);
	});

	it("measures by the minute rather than in whole days", () => {
		// Thirty in the first twelve hours is sixty a day, not thirty.
		expect(
			computeVelocity({
				startDate: "2026-09-01",
				deadline: null,
				current: 30,
				target: 400,
				now: at(9, 1, 12),
			}).perDay,
		).toBe(60);
	});

	it("has no speed in the first quarter hour", () => {
		const velocity = computeVelocity({
			startDate: "2026-09-01",
			deadline: null,
			current: 30,
			target: 400,
			now: at(9, 1, 0, 10),
		});

		expect(velocity.perDay).toBeNull();
		expect(velocity.projectedFinish).toBeNull();
	});

	it("projects when the target is reached at that pace", () => {
		// 300 left at 10/day lands 30 days after now.
		expect(
			computeVelocity({
				startDate: "2026-09-01",
				deadline: null,
				current: 100,
				target: 400,
				now: at(9, 11),
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
				now: at(9, 11),
			}).requiredPerDay,
		).toBe(30);
	});

	it("counts the deadline's time as part of the window", () => {
		// Ten and a half days for 210: twenty a day, not twenty-one.
		const velocity = computeVelocity({
			startDate: "2026-09-01",
			deadline: "2026-09-11",
			deadlineTime: "12:00",
			current: 0,
			target: 210,
			now: at(9, 1),
		});

		expect(velocity.totalMinutes).toBe(10.5 * 1440);
		expect(velocity.expectedPerDay).toBe(20);
	});

	it("asks for more than the planned speed once behind", () => {
		// Page 59 to 528 by 23:59 on 8 Oct, at page 67 by 8 pm on day one. In
		// whole days, today was all still "left", the deadline's last day was
		// lost, and the speed needed came out below the one planned.
		const plan = {
			startDate: "2026-09-12",
			deadline: "2026-10-08",
			deadlineTime: "23:59",
			start: 59,
			current: 67,
			target: 528,
			now: at(9, 12, 20),
		};
		const { expectedPerDay, requiredPerDay } = computeVelocity(plan);

		expect(
			paceStatus({ ...plan, fractionComplete: trackerFraction(67, 528, 59) }),
		).toBe("behind");
		expect(requiredPerDay).not.toBeNull();
		expect(expectedPerDay).not.toBeNull();
		expect(requiredPerDay ?? 0).toBeGreaterThan(expectedPerDay ?? 0);
	});

	it("does not project a finish for something that is not moving", () => {
		expect(
			computeVelocity({
				startDate: "2026-09-01",
				deadline: null,
				current: 0,
				target: 400,
				now: at(9, 11),
			}).projectedFinish,
		).toBeNull();
	});

	it("asks for nothing more once the target is met", () => {
		const velocity = computeVelocity({
			startDate: "2026-09-01",
			deadline: "2026-09-21",
			current: 400,
			target: 400,
			now: at(9, 11),
		});

		expect(velocity.requiredPerDay).toBe(0);
		expect(velocity.projectedFinish).toBeNull();
	});

	it("asks the rest of a single day once the deadline has passed", () => {
		expect(
			computeVelocity({
				startDate: "2026-09-01",
				deadline: "2026-09-05",
				current: 100,
				target: 400,
				now: at(9, 11),
			}).requiredPerDay,
		).toBe(300);
	});

	it("has no required pace without a deadline", () => {
		const velocity = computeVelocity({
			startDate: "2026-09-01",
			deadline: null,
			current: 100,
			target: 400,
			now: at(9, 11),
		});

		expect(velocity.requiredPerDay).toBeNull();
		expect(velocity.minutesRemaining).toBeNull();
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
			now: new Date(2026, 0, 1).getTime(),
		});

		expect(velocity.expectedPerDay).toBe(8);
	});

	it("counts only the pages actually turned", () => {
		const velocity = computeVelocity({
			...plan,
			current: 49,
			now: new Date(2026, 0, 2).getTime(),
		});

		// Nine pages in one day, not forty-nine.
		expect(velocity.perDay).toBe(9);
	});
});
