/**
 * Progress, pace and velocity calculations.
 *
 * Pure functions shared by checklists and trackers. Nothing here knows about
 * the database, React or the network.
 */

import type { PaceStatus } from "#/schemas/checklist";
import { todayDateOnly } from "#/schemas/common";
import type { Velocity } from "#/schemas/progress";
import type { ProgressEntry, TrackerProgress } from "#/schemas/tracker";

/**
 * How far actual progress may drift from elapsed time before it stops counting
 * as "on track". Ten percentage points keeps the label from flickering.
 */
const PACE_TOLERANCE = 0.1;

const MS_PER_DAY = 86_400_000;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function clampPercent(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(100, Math.max(0, Math.round(value)));
}

/* -------------------------------------------------------------------------- */
/* Calendar arithmetic                                                        */
/* -------------------------------------------------------------------------- */

/** Midnight UTC for a `YYYY-MM-DD` string, or `null` if unparseable. */
function parseDateOnly(value: string | null): number | null {
	if (!value || !DATE_ONLY.test(value)) return null;
	const time = Date.parse(`${value}T00:00:00Z`);
	return Number.isNaN(time) ? null : time;
}

/**
 * Whole days from `from` to `to`. Negative when `to` is earlier. Both are
 * calendar days, so this never drifts by an hour across a daylight-saving
 * boundary the way a timestamp subtraction would.
 */
export function daysBetween(from: string, to: string): number | null {
	const start = parseDateOnly(from);
	const end = parseDateOnly(to);
	if (start === null || end === null) return null;
	return Math.round((end - start) / MS_PER_DAY);
}

/** `YYYY-MM-DD` a whole number of days after `date`. */
export function addDays(date: string, days: number): string | null {
	const start = parseDateOnly(date);
	if (start === null || !Number.isFinite(days)) return null;
	return new Date(start + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/* Tracker readings                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A tracker's headline numbers.
 *
 * Progress is measured across the distance actually to be covered, not from
 * zero: a book opened at page 40 and finished at page 80 is halfway at page 60,
 * not three-quarters of the way. `current` and `target` stay the real readings,
 * because those are the numbers the user typed and expects to see.
 *
 * `percent` is clamped to 0-100 for display even when a goal has been beaten or
 * the reading has slipped below where it started, so a bar never overflows or
 * runs backwards off its track.
 */
export function trackerProgress(
	current: number,
	target: number,
	start = 0,
): TrackerProgress {
	const safeCurrent = Number.isFinite(current) ? current : 0;
	const safeTarget = Number.isFinite(target) ? target : 0;
	const safeStart = Number.isFinite(start) ? start : 0;

	const distance = safeTarget - safeStart;

	return {
		current: safeCurrent,
		target: safeTarget,
		percent:
			distance > 0
				? clampPercent(((safeCurrent - safeStart) / distance) * 100)
				: 0,
	};
}

/**
 * A reading as it is stored: everything an entry has except its step, which is
 * always derived from the reading before it.
 */
export type EntryReading = Omit<ProgressEntry, "delta">;

/**
 * Entries are ordered by the day they were recorded and then by id, which is
 * time-sortable. Back-dating an entry therefore drops it into the right place
 * in the history rather than onto the end.
 */
function compareEntries(a: EntryReading, b: EntryReading): number {
	if (a.recordedAt !== b.recordedAt)
		return a.recordedAt < b.recordedAt ? -1 : 1;
	return a.entryId < b.entryId ? -1 : 1;
}

export function sortEntriesOldestFirst<T extends EntryReading>(
	entries: ReadonlyArray<T>,
): Array<T> {
	return [...entries].sort(compareEntries);
}

/**
 * Work out every `delta` from the reading before it.
 *
 * The user always enters where they have got to — page 78 — and the step from
 * the previous reading is derived here rather than stored. That is what lets a
 * reading be back-dated or corrected in the middle of a history: the entries
 * around it re-space themselves on the next read, with nothing to keep in step.
 */
export function withDeltas(
	entries: ReadonlyArray<EntryReading>,
	/** Where the count stood before the first reading. */
	start = 0,
): Array<ProgressEntry> {
	let previous = start;

	return sortEntriesOldestFirst(entries).map((entry) => {
		const delta = entry.value - previous;
		previous = entry.value;
		return { ...entry, delta };
	});
}

/**
 * Current progress is the most recent reading, not the sum of the steps. The
 * two agree by construction, but the reading is what the user typed.
 *
 * With no readings yet the tracker stands where it started, which for a book
 * opened at page 40 is page 40 rather than page 0.
 */
export function deriveCurrentValue(
	entries: ReadonlyArray<EntryReading>,
	start = 0,
): number {
	const ordered = sortEntriesOldestFirst(entries);
	const latest = ordered[ordered.length - 1];
	return latest ? latest.value : start;
}

/* -------------------------------------------------------------------------- */
/* Pace                                                                       */
/* -------------------------------------------------------------------------- */

export type PaceInput = {
	/** `YYYY-MM-DD` the work began. */
	startDate: string;
	/** `YYYY-MM-DD` it should be finished by, or `null` when none was set. */
	deadline: string | null;
	/** Today, as `YYYY-MM-DD`. Injectable so the maths stays testable. */
	today?: string;
};

/**
 * How much of the available time has gone, 0-1.
 *
 * `null` when there is not enough information: no deadline, an unparseable
 * start, or a window with no length. Also drives the target mark drawn on
 * progress bars, so the bar and the label always agree.
 */
export function elapsedFraction(input: PaceInput): number | null {
	const today = input.today ?? todayDateOnly();
	const window = daysBetween(input.startDate, input.deadline ?? "");
	const gone = daysBetween(input.startDate, today);

	// The deadline must be after the start for "elapsed" to mean anything.
	if (window === null || gone === null || window <= 0) return null;

	return Math.min(1, Math.max(0, gone / window));
}

/**
 * Compare how much is done against how much of the time has passed.
 *
 * Returns `null` whenever there is not enough information to judge. A missing
 * status is shown as nothing at all rather than an invented one.
 */
export function paceStatus(
	input: PaceInput & {
		/** Completion so far, 0-1. */
		fractionComplete: number;
	},
): PaceStatus | null {
	const elapsed = elapsedFraction(input);
	if (elapsed === null) return null;

	const actual = Math.min(1, Math.max(0, input.fractionComplete));
	const drift = actual - elapsed;

	if (drift > PACE_TOLERANCE) return "ahead";
	if (drift < -PACE_TOLERANCE) return "behind";
	return "on_track";
}

/**
 * How fast something is moving, when it lands at that speed, and how fast it
 * would have to move to hit the deadline.
 *
 * Works for anything with a start, a target and a current position, so a
 * checklist counting tasks and a tracker counting pages get the same figures
 * from the same code.
 *
 * Day one counts as a whole day, so something started today reports the pace it
 * actually achieved rather than dividing by zero and reporting nothing.
 */
export function computeVelocity(
	input: PaceInput & { current: number; target: number; start?: number },
): Velocity {
	const today = input.today ?? todayDateOnly();
	const elapsed = daysBetween(input.startDate, today);
	const daysElapsed = elapsed === null ? 0 : Math.max(0, elapsed);

	const daysRemaining =
		input.deadline === null ? null : daysBetween(today, input.deadline);
	const totalDays =
		input.deadline === null
			? null
			: daysBetween(input.startDate, input.deadline);

	/*
	 * Distances, not readings.
	 *
	 * A book opened at page 40 has covered nothing on day one, and reaching page
	 * 80 is 40 pages of work rather than 80. Measuring from the starting point is
	 * what keeps "pages per day" the number of pages actually turned.
	 */
	const start = input.start ?? 0;
	const covered = Math.max(0, input.current - start);
	const outstanding = Math.max(0, input.target - input.current);
	const distance = Math.max(0, input.target - start);

	const perDay = covered / Math.max(daysElapsed, 1);

	// What the deadline asked for on day one, which is the bar the current pace
	// is really being measured against.
	const expectedPerDay =
		totalDays === null || totalDays <= 0 ? null : distance / totalDays;

	// A deadline already past cannot be spread over days that do not exist, so
	// the requirement collapses onto today rather than dividing by zero.
	const requiredPerDay =
		daysRemaining === null
			? null
			: outstanding === 0
				? 0
				: outstanding / Math.max(daysRemaining, 1);

	const projectedFinish =
		outstanding === 0 || perDay <= 0
			? null
			: addDays(today, Math.ceil(outstanding / perDay));

	return {
		daysElapsed,
		daysRemaining,
		totalDays,
		perDay,
		expectedPerDay,
		requiredPerDay,
		projectedFinish,
	};
}

/**
 * How far behind a thing is, as a fraction of the whole job.
 *
 * The gap between where the calendar says it should be and where it is: 0.4
 * means forty per cent of the work is owed. Negative means ahead. Something
 * with no deadline is asking nothing of anyone, so it is neither, and something
 * finished is done being measured — both come back as zero, which puts them
 * below anything genuinely lagging without inventing an order among them.
 *
 * A degree rather than a band, so a list sorted by it reads worst-first all the
 * way down instead of grouping everything unfinished together.
 */
export function lagFraction(input: {
	startDate: string;
	deadline: string | null;
	/** Progress so far, 0 to 1. */
	fractionComplete: number;
}): number {
	if (input.fractionComplete >= 1) return 0;

	const expected = elapsedFraction(input);
	if (expected === null) return 0;

	return expected - input.fractionComplete;
}
