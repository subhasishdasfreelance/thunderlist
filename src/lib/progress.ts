/**
 * Progress, pace and velocity calculations.
 *
 * Pure functions shared by checklists and trackers. Nothing here knows about
 * the database, React or the network.
 */

import type { PaceStatus } from "#/schemas/checklist";
import { type DailyWindow, todayDateOnly } from "#/schemas/common";
import type { Velocity } from "#/schemas/progress";
import type { ProgressEntry, TrackerProgress } from "#/schemas/tracker";

/**
 * How far actual progress may drift from elapsed time before it stops counting
 * as "on track": one percentage point either way.
 *
 * Narrow on purpose: anything further adrift than that is worth hearing about,
 * in either direction. Today reads its pace against the same figure, so
 * "Behind" means the same thing on every screen.
 */
export const PACE_TOLERANCE = 0.01;

const MS_PER_DAY = 86_400_000;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

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

/**
 * The day a tracker reached its target and has stayed there since, or `null`
 * while it has not.
 *
 * A tag counts a tracker as done from this day, the way it counts a task from
 * the moment it was ticked. A reading that slipped back below the target starts
 * the count again, so this is the start of the current run at the target, not
 * the first time it ever got there.
 */
export function reachedTargetOn(
	entries: ReadonlyArray<EntryReading>,
	target: number,
	start = 0,
): string | null {
	let since: string | null = null;

	for (const entry of sortEntriesOldestFirst(entries)) {
		const reached = trackerProgress(entry.value, target, start).percent >= 100;
		since = reached ? (since ?? entry.recordedAt) : null;
	}

	return since;
}

/* -------------------------------------------------------------------------- */
/* Pace                                                                       */
/* -------------------------------------------------------------------------- */

export type PaceInput = {
	/** `YYYY-MM-DD` the work began. */
	startDate: string;
	/** `YYYY-MM-DD` it should be finished by, or `null` when none was set. */
	deadline: string | null;
	/** `HH:MM` on the deadline day it is due by; without one, that day's start. */
	deadlineTime?: string | null;
	/**
	 * The hours of every day it is paced across instead of a deadline, for
	 * something that repeats daily; see `DailyWindow`.
	 */
	dailyWindow?: DailyWindow | null;
	/**
	 * Today, as `YYYY-MM-DD`, for the speeds, which are counted in days.
	 * Injectable so the maths stays testable.
	 */
	today?: string;
	/**
	 * This moment, as a timestamp, for how much of the time has gone.
	 * Injectable for the same reason.
	 */
	now?: number;
};

/** A `YYYY-MM-DD` day — at an `HH:MM` on it, if given — on the viewer's clock. */
export function localMoment(
	date: string | null,
	time?: string | null,
): number | null {
	if (!date || !DATE_ONLY.test(date)) return null;

	const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
	const [hours = 0, minutes = 0] =
		time && TIME_OF_DAY.test(time) ? time.split(":").map(Number) : [];
	const moment = new Date(year, month - 1, day, hours, minutes).getTime();

	return Number.isNaN(moment) ? null : moment;
}

/** Today's stretch of a daily window, as two moments on the viewer's clock. */
export function todayWindow(
	window: DailyWindow,
	now: number,
): { start: number; end: number } | null {
	const day = new Date(now);
	const at = (time: string) => {
		if (!TIME_OF_DAY.test(time)) return null;
		const [hours = 0, minutes = 0] = time.split(":").map(Number);
		return new Date(
			day.getFullYear(),
			day.getMonth(),
			day.getDate(),
			hours,
			minutes,
		).getTime();
	};

	const start = at(window.from);
	const end = at(window.to);

	return start === null || end === null || end <= start ? null : { start, end };
}

/**
 * The stretch of time something is paced across, as two moments.
 *
 * With a daily window it is today's part of it — 06:00 to 22:00 today,
 * whichever day that is. Otherwise it runs from the start of the start date to
 * the deadline: at its time if it has one, or the start of that day.
 *
 * Both are read on the viewer's own clock, because "due at 18:00" and "from six
 * in the morning" mean the clock on the wall where the viewer is. That is also
 * why nothing worked out from this is drawn by the server, which does not know
 * that clock; see `useNow`.
 *
 * `null` when there is nothing to measure against: no deadline, a date that
 * does not parse, or a window with no length.
 */
export function paceWindow(
	input: PaceInput,
	now: number,
): { start: number; end: number } | null {
	if (input.dailyWindow) return todayWindow(input.dailyWindow, now);

	const start = localMoment(input.startDate);
	const end = localMoment(input.deadline, input.deadlineTime);

	// The deadline must be after the start for "elapsed" to mean anything.
	return start === null || end === null || end <= start ? null : { start, end };
}

/**
 * How much of the available time has gone, 0-1.
 *
 * Measured to the moment, in fractional hours: four and a half hours into a
 * nine-hour window is exactly half. Counted in whole days the mark stood still
 * from midnight to midnight and then jumped; in whole hours it still jumped on
 * the hour. The speeds are counted in days; this is only where the mark sits,
 * and what "ahead" and "behind" are judged against.
 *
 * `null` when there is not enough information; see `paceWindow`. Also drives
 * the target mark drawn on progress bars, so the bar and the label always
 * agree.
 */
export function elapsedFraction(input: PaceInput): number | null {
	const now = input.now ?? Date.now();
	const window = paceWindow(input, now);
	if (window === null) return null;

	return Math.min(
		1,
		Math.max(0, (now - window.start) / (window.end - window.start)),
	);
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
export function lagFraction(
	input: PaceInput & {
		/** Progress so far, 0 to 1. */
		fractionComplete: number;
	},
): number {
	if (input.fractionComplete >= 1) return 0;

	const expected = elapsedFraction(input);
	if (expected === null) return 0;

	return expected - input.fractionComplete;
}

/**
 * Whether something is past its deadline with work still left.
 *
 * For something paced daily, that is today's window having closed on an
 * unfinished list. Nothing without a deadline is ever overdue.
 */
export function isOverdue(
	input: PaceInput & {
		/** Progress so far, 0 to 1. */
		fractionComplete: number;
	},
): boolean {
	if (input.fractionComplete >= 1) return false;

	const now = input.now ?? Date.now();
	const window = paceWindow(input, now);
	return window !== null && now >= window.end;
}

/**
 * Most behind first, for ordering a screen of cards.
 *
 * Anything overdue leads, then the rest by how much of the work is owed; see
 * `lagFraction`. Overdue has to be its own step: something due yesterday and
 * nine-tenths done owes less of the whole than something halfway through its
 * time and untouched, but only one of them has already missed its date. Within
 * each group, the one owing the most comes first.
 */
export function compareBehind(
	a: PaceInput & { fractionComplete: number },
	b: PaceInput & { fractionComplete: number },
): number {
	return (
		Number(isOverdue(b)) - Number(isOverdue(a)) ||
		lagFraction(b) - lagFraction(a)
	);
}
