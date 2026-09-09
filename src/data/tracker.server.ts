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
	computeVelocity,
	deriveCurrentValue,
	paceStatus,
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
	trackerId: string,
): Promise<Tracker> {
	const tracker = await current.trackers.findOne(
		{ trackerId },
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
	trackerId: string,
): Promise<Array<ProgressEntry>> {
	const readings = await current.entries
		.find({ trackerId }, { projection: ENTRY_FIELDS })
		.toArray();

	return withDeltas(readings);
}

/**
 * One reading, taken from the history rather than read on its own: its step is
 * the distance from the reading before it, which only the history knows.
 */
async function requireEntry(
	current: Collections,
	trackerId: string,
	entryId: string,
): Promise<ProgressEntry> {
	const history = await readEntries(current, trackerId);
	const entry = history.find((candidate) => candidate.entryId === entryId);

	if (!entry) throw new AppError("not_found", "That entry no longer exists.");

	return entry;
}

function summarise(tracker: Tracker): TrackerSummary {
	const progress = trackerProgress(tracker.currentValue, tracker.targetValue);

	return {
		...tracker,
		progress,
		status:
			tracker.targetValue > 0
				? paceStatus({
						startDate: tracker.startDate,
						deadline: tracker.deadline,
						fractionComplete: tracker.currentValue / tracker.targetValue,
					})
				: null,
	};
}

/** One read: no history is touched. */
export async function listTrackers(): Promise<Array<TrackerSummary>> {
	const current = await collections();
	const trackers = await current.trackers
		.find({}, { projection: DOMAIN_FIELDS })
		.toArray();

	return trackers.map(summarise);
}

/** Full history is only read when a tracker is opened. */
export async function getTracker(trackerId: string): Promise<TrackerDetail> {
	const current = await collections();
	const tracker = await requireTracker(current, trackerId);
	const entries = await readEntries(current, trackerId);
	const summary = summarise(tracker);

	return {
		...summary,
		entries,
		velocity: computeVelocity({
			startDate: summary.startDate,
			deadline: summary.deadline,
			current: summary.currentValue,
			target: summary.targetValue,
		}),
	};
}

/* -------------------------------------------------------------------------- */
/* Tracker lifecycle                                                          */
/* -------------------------------------------------------------------------- */

export async function createTracker(input: {
	trackerId: string;
	title: string;
	type: TrackerType;
	unit: string;
	targetValue: number;
	startDate: string;
	deadline: string | null;
	description: string;
	coverUrl: string | null;
	author: string;
}): Promise<Tracker> {
	const current = await collections();

	// Replaying a change that already went in must not create a second copy; see
	// `applyChanges`, which can retry after a partial failure.
	const existing = await current.trackers.findOne(
		{ trackerId: input.trackerId },
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
		currentValue: 0,
		coverUrl: input.coverUrl,
		author: input.author === "" ? null : input.author,
		startDate: input.startDate,
		deadline: input.deadline,
		createdAt: now,
		updatedAt: now,
	};

	await current.trackers.insertOne(tracker);

	return tracker;
}

export async function updateTracker(
	trackerId: string,
	patch: {
		title?: string;
		type?: TrackerType;
		unit?: string;
		targetValue?: number;
		startDate?: string;
		deadline?: string | null;
		description?: string;
		coverUrl?: string | null;
		author?: string;
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
		{ trackerId },
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
export async function deleteTracker(trackerId: string): Promise<void> {
	const current = await collections();

	await current.entries.deleteMany({ trackerId });
	await current.trackers.deleteOne({ trackerId });
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
	trackerId: string,
): Promise<void> {
	const readings = await current.entries
		.find({ trackerId }, { projection: ENTRY_FIELDS })
		.toArray();

	await current.trackers.updateOne(
		{ trackerId },
		{
			$set: {
				currentValue: deriveCurrentValue(readings),
				updatedAt: new Date().toISOString(),
			},
		},
	);
}

export async function createProgressEntry(input: {
	trackerId: string;
	entryId: string;
	value: number;
	recordedAt: string;
	note: string;
}): Promise<ProgressEntry> {
	const current = await collections();
	const tracker = await requireTracker(current, input.trackerId);
	assertValueAllowed(tracker, input.value);

	const existing = await current.entries.findOne({ entryId: input.entryId });
	if (existing) return requireEntry(current, input.trackerId, input.entryId);

	const reading: EntryDoc = {
		trackerId: input.trackerId,
		entryId: input.entryId,
		recordedAt: input.recordedAt,
		value: input.value,
		note: input.note,
		updatedAt: new Date().toISOString(),
	};

	await current.entries.insertOne(reading);
	await refreshCurrentValue(current, input.trackerId);

	return requireEntry(current, input.trackerId, input.entryId);
}

export async function updateProgressEntry(
	trackerId: string,
	entryId: string,
	patch: { value?: number; recordedAt?: string; note?: string },
): Promise<ProgressEntry> {
	const current = await collections();
	const tracker = await requireTracker(current, trackerId);
	if (patch.value !== undefined) assertValueAllowed(tracker, patch.value);

	const updated = await current.entries.updateOne(
		{ entryId, trackerId },
		{ $set: { ...patch, updatedAt: new Date().toISOString() } },
	);

	if (updated.matchedCount === 0) {
		throw new AppError("not_found", "That entry no longer exists.");
	}

	await refreshCurrentValue(current, trackerId);

	// Editing or back-dating a reading changes the step of the one after it too.
	return requireEntry(current, trackerId, entryId);
}

export async function deleteProgressEntry(
	trackerId: string,
	entryId: string,
): Promise<void> {
	const current = await collections();

	// Already gone is the outcome this asked for, not a failure.
	await current.entries.deleteOne({ entryId, trackerId });
	await refreshCurrentValue(current, trackerId);
}
