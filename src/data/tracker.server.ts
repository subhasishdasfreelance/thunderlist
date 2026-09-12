/**
 * Trackers and their progress history. Server only.
 *
 * A tracker is one document and each reading is another, linked by `trackerId`.
 * `currentValue` is kept on the tracker so listing is a single read that never
 * touches a history; it is recomputed from the readings whenever one changes,
 * so the copy cannot drift from what it summarises.
 */

import { AppError } from "#/lib/errors";
import {
	type Collections,
	collections,
	DOMAIN_FIELDS,
	type EntryDoc,
} from "#/lib/mongo/client.server";
import {
	deriveCurrentValue,
	trackerProgress,
	withDeltas,
} from "#/lib/progress";
import type {
	ProgressEntry,
	Tracker,
	TrackerDetail,
	TrackerSummary,
	TrackerType,
} from "#/schemas/tracker";
import { allowsOvershoot } from "#/schemas/tracker";

/** An entry document holds the link to its tracker; a reading does not. */
const ENTRY_FIELDS = { _id: 0, trackerId: 0 } as const;

async function requireTracker(
	current: Collections,
	userId: string,
	trackerId: string,
): Promise<Tracker> {
	const tracker = await current.trackers.findOne(
		{ trackerId, userId },
		{ projection: DOMAIN_FIELDS },
	);

	if (!tracker) {
		throw new AppError("not_found", "That tracker no longer exists.");
	}

	return tracker;
}

/** The full history, oldest first, with each step worked out from the last. */
async function readEntries(
	current: Collections,
	userId: string,
	trackerId: string,
	/** Where the count stood before the first reading; the first step is from it. */
	startValue: number,
): Promise<Array<ProgressEntry>> {
	const readings = await current.entries
		.find({ trackerId, userId }, { projection: ENTRY_FIELDS })
		.toArray();

	return withDeltas(readings, startValue);
}

/**
 * One reading, taken from the history rather than read on its own: its step is
 * the distance from the reading before it, which only the history knows.
 */
async function requireEntry(
	current: Collections,
	userId: string,
	trackerId: string,
	startValue: number,
	entryId: string,
): Promise<ProgressEntry> {
	const history = await readEntries(current, userId, trackerId, startValue);
	const entry = history.find((candidate) => candidate.entryId === entryId);

	if (!entry) throw new AppError("not_found", "That entry no longer exists.");

	return entry;
}

/**
 * A tracker with its progress. Its pace is judged in the browser, on the
 * viewer's own clock, which this server does not know; see `usePace`.
 */
export function summarise(tracker: Tracker): TrackerSummary {
	return {
		...tracker,
		progress: trackerProgress(
			tracker.currentValue,
			tracker.targetValue,
			tracker.startValue,
		),
	};
}

/** One read: no history is touched. */
export async function listTrackers(
	userId: string,
): Promise<Array<TrackerSummary>> {
	const current = await collections();
	const trackers = await current.trackers
		.find({ userId }, { projection: DOMAIN_FIELDS })
		.toArray();

	return trackers.map(summarise);
}

/** Full history is only read when a tracker is opened. */
/**
 * The figures at the top of a tracker: one document, no history.
 *
 * Split from `getTrackerEntries` so the screen can answer "how is this going"
 * from a single small read while the entries are still on their way.
 */
export async function getTracker(
	userId: string,
	trackerId: string,
): Promise<TrackerDetail> {
	const current = await collections();
	const tracker = await requireTracker(current, userId, trackerId);

	return summarise(tracker);
}

/** The history on its own, oldest first. */
export async function getTrackerEntries(
	userId: string,
	trackerId: string,
): Promise<Array<ProgressEntry>> {
	const current = await collections();
	const tracker = await requireTracker(current, userId, trackerId);

	return readEntries(current, userId, trackerId, tracker.startValue);
}

/* -------------------------------------------------------------------------- */
/* Tracker lifecycle                                                          */
/* -------------------------------------------------------------------------- */

export async function createTracker(
	userId: string,
	input: {
		trackerId: string;
		title: string;
		type: TrackerType;
		unit: string;
		targetValue: number;
		startValue: number;
		startDate: string;
		deadline: string | null;
		deadlineTime: string | null;
		description: string;
		coverUrl: string | null;
		author: string;
		tagIds: Array<string>;
	},
): Promise<Tracker> {
	const current = await collections();

	// Replaying a change that already went in must not create a second copy; see
	// `applyChanges`, which can retry after a partial failure.
	const existing = await current.trackers.findOne(
		{ trackerId: input.trackerId, userId },
		{ projection: DOMAIN_FIELDS },
	);
	if (existing) return existing;

	const now = new Date().toISOString();
	// Listed field by field rather than spread: the caller passes the whole
	// queued change, and spreading it would store its `kind` alongside.
	const tracker: Tracker = {
		trackerId: input.trackerId,
		title: input.title,
		type: input.type,
		description: input.description,
		unit: input.unit,
		targetValue: input.targetValue,
		startValue: input.startValue,
		// Nothing has been recorded yet, so the tracker stands where it started.
		currentValue: input.startValue,
		coverUrl: input.coverUrl,
		author: input.author === "" ? null : input.author,
		startDate: input.startDate,
		deadline: input.deadline,
		deadlineTime: input.deadlineTime,
		tagIds: input.tagIds,
		createdAt: now,
		updatedAt: now,
	};

	await current.trackers.insertOne({ ...tracker, userId });

	return tracker;
}

export async function updateTracker(
	userId: string,
	trackerId: string,
	patch: {
		title?: string;
		type?: TrackerType;
		unit?: string;
		targetValue?: number;
		startValue?: number;
		startDate?: string;
		deadline?: string | null;
		deadlineTime?: string | null;
		description?: string;
		coverUrl?: string | null;
		author?: string;
		tagIds?: Array<string>;
	},
): Promise<Tracker> {
	const current = await collections();

	const changes: Partial<Tracker> = {
		...patch,
		updatedAt: new Date().toISOString(),
	};
	// A cleared author field is stored as "no author" rather than an empty string.
	if (patch.author !== undefined) changes.author = patch.author || null;

	const next = await current.trackers.findOneAndUpdate(
		{ trackerId, userId },
		{ $set: changes },
		{ returnDocument: "after", projection: DOMAIN_FIELDS },
	);

	if (!next) {
		throw new AppError("not_found", "That tracker no longer exists.");
	}

	return next;
}

/**
 * Remove a tracker and its readings.
 *
 * The readings go first: a tracker left holding its history is still usable,
 * whereas readings whose tracker has gone belong to nothing.
 */
export async function deleteTracker(
	userId: string,
	trackerId: string,
): Promise<void> {
	const current = await collections();

	await current.entries.deleteMany({ trackerId, userId });
	await current.trackers.deleteOne({ trackerId, userId });
}

/* -------------------------------------------------------------------------- */
/* Progress entries                                                           */
/* -------------------------------------------------------------------------- */

function assertValueAllowed(tracker: Tracker, value: number): void {
	if (
		tracker.targetValue > 0 &&
		value > tracker.targetValue &&
		!allowsOvershoot(tracker.type)
	) {
		throw new AppError(
			"invalid_data",
			`Progress cannot exceed the target of ${tracker.targetValue} ${tracker.unit}.`,
		);
	}
}

/**
 * Bring the tracker's denormalised total back in line with its readings.
 *
 * Run after every change to the history, because a reading can be added,
 * edited, back-dated or deleted anywhere in it, and any of those can change
 * which reading is the latest one.
 */
async function refreshCurrentValue(
	current: Collections,
	userId: string,
	trackerId: string,
	startValue: number,
): Promise<void> {
	const readings = await current.entries
		.find({ trackerId, userId }, { projection: ENTRY_FIELDS })
		.toArray();

	await current.trackers.updateOne(
		{ trackerId, userId },
		{
			$set: {
				currentValue: deriveCurrentValue(readings, startValue),
				updatedAt: new Date().toISOString(),
			},
		},
	);
}

export async function createProgressEntry(
	userId: string,
	input: {
		trackerId: string;
		entryId: string;
		value: number;
		recordedAt: string;
		note: string;
	},
): Promise<ProgressEntry> {
	const current = await collections();
	const tracker = await requireTracker(current, userId, input.trackerId);
	assertValueAllowed(tracker, input.value);

	const existing = await current.entries.findOne({
		entryId: input.entryId,
		userId,
	});
	if (existing) {
		return requireEntry(
			current,
			userId,
			input.trackerId,
			tracker.startValue,
			input.entryId,
		);
	}

	const reading: EntryDoc = {
		userId,
		trackerId: input.trackerId,
		entryId: input.entryId,
		recordedAt: input.recordedAt,
		value: input.value,
		note: input.note,
		updatedAt: new Date().toISOString(),
	};

	await current.entries.insertOne(reading);
	await refreshCurrentValue(
		current,
		userId,
		input.trackerId,
		tracker.startValue,
	);

	return requireEntry(
		current,
		userId,
		input.trackerId,
		tracker.startValue,
		input.entryId,
	);
}

export async function updateProgressEntry(
	userId: string,
	trackerId: string,
	entryId: string,
	patch: { value?: number; recordedAt?: string; note?: string },
): Promise<ProgressEntry> {
	const current = await collections();
	const tracker = await requireTracker(current, userId, trackerId);
	if (patch.value !== undefined) assertValueAllowed(tracker, patch.value);

	const updated = await current.entries.updateOne(
		{ entryId, trackerId, userId },
		{ $set: { ...patch, updatedAt: new Date().toISOString() } },
	);

	if (updated.matchedCount === 0) {
		throw new AppError("not_found", "That entry no longer exists.");
	}

	await refreshCurrentValue(current, userId, trackerId, tracker.startValue);

	// Editing or back-dating a reading changes the step of the one after it too.
	return requireEntry(current, userId, trackerId, tracker.startValue, entryId);
}

export async function deleteProgressEntry(
	userId: string,
	trackerId: string,
	entryId: string,
): Promise<void> {
	const current = await collections();

	const tracker = await requireTracker(current, userId, trackerId);

	// Already gone is the outcome this asked for, not a failure.
	await current.entries.deleteOne({ entryId, trackerId, userId });
	await refreshCurrentValue(current, userId, trackerId, tracker.startValue);
}
