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
import type { AccessEntry } from "#/schemas/access";
import type { ImageRef } from "#/schemas/common";
import type { ImportGroupInput } from "#/schemas/group";
import type {
	ProgressEntry,
	Tracker,
	TrackerDetail,
	TrackerSummary,
	TrackerType,
} from "#/schemas/tracker";
import { allowsOvershoot } from "#/schemas/tracker";
import {
	clearDependencies,
	isOnlyDuplicates,
	releaseFollowers,
} from "./checklist.server";
import { nextNumber, nextNumbers } from "./numbers.server";
import { type Hidden, withAccess } from "./visibility.server";

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
		// However its audience was stored, the app reads one field; see
		// `withAccess`.
		...withAccess(tracker),
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
	hidden: Hidden,
): Promise<Array<TrackerSummary>> {
	const current = await collections();
	const trackers = await current.trackers
		.find({ userId }, { projection: DOMAIN_FIELDS })
		.toArray();

	return (
		trackers
			// Kept from this person in their team: to them it does not exist.
			.filter((tracker) => !hidden.trackerIds.has(tracker.trackerId))
			.map(summarise)
	);
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
		caption: string;
		type: TrackerType;
		unit: string;
		targetValue: number;
		startValue: number;
		startDate: string;
		/** Absent for none; see `Tracker.startTime`. */
		startTime?: string | null;
		deadline: string | null;
		deadlineTime: string | null;
		description: string;
		coverUrl: string | null;
		author: string;
		tagIds: Array<string>;
		assignees: Array<string>;
		access: Array<AccessEntry> | null;
		images?: Array<ImageRef>;
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
		caption: input.caption,
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
		startTime: input.startTime ?? null,
		deadline: input.deadline,
		deadlineTime: input.deadlineTime,
		tagIds: input.tagIds,
		assignees: input.assignees,
		access: input.access,
		...(input.images?.length ? { images: input.images } : {}),
		createdAt: now,
		updatedAt: now,
	};

	tracker.number = await nextNumber(current, userId, "tracker");
	await current.trackers.insertOne({ ...tracker, userId });

	return tracker;
}

/**
 * Make many trackers at once — the `&` headings of an outline pasted into a
 * group — in one write rather than a request each; see `parseOutline`.
 *
 * Asked again after a dropped connection, what is already written is left as
 * it is and only the rest is added, as `importChecklists` does.
 */
export async function importTrackers(
	userId: string,
	input: Pick<ImportGroupInput, "startDate" | "trackers">,
): Promise<void> {
	if (input.trackers.length === 0) return;
	const current = await collections();

	const written = await current.trackers
		.find(
			{
				userId,
				trackerId: { $in: input.trackers.map((each) => each.trackerId) },
			},
			{ projection: { _id: 0, trackerId: 1 } },
		)
		.toArray();
	const isWritten = new Set(written.map((each) => each.trackerId));
	const fresh = input.trackers.filter((each) => !isWritten.has(each.trackerId));
	if (fresh.length === 0) return;

	const now = new Date().toISOString();
	let next = await nextNumbers(current, userId, "tracker", fresh.length);
	try {
		await current.trackers.insertMany(
			fresh.map((each) => ({
				trackerId: each.trackerId,
				number: next++,
				title: each.title,
				caption: "",
				type: each.type,
				description: each.description,
				unit: each.unit,
				targetValue: each.targetValue,
				startValue: each.startValue,
				// Nothing has been recorded yet, so it stands where it started.
				currentValue: each.startValue,
				coverUrl: null,
				author: null,
				startDate: input.startDate,
				deadline: each.deadline ?? null,
				deadlineTime: each.deadlineTime ?? null,
				tagIds: [],
				assignees: [],
				access: null,
				...(each.urgent ? { urgent: true } : {}),
				...(each.important ? { important: true } : {}),
				createdAt: now,
				updatedAt: now,
				userId,
			})),
			{ ordered: false },
		);
	} catch (error) {
		if (!isOnlyDuplicates(error)) throw error;
	}
}

export async function updateTracker(
	userId: string,
	trackerId: string,
	patch: {
		title?: string;
		caption?: string;
		type?: TrackerType;
		unit?: string;
		targetValue?: number;
		startValue?: number;
		startDate?: string;
		startTime?: string | null;
		deadline?: string | null;
		deadlineTime?: string | null;
		description?: string;
		coverUrl?: string | null;
		images?: Array<ImageRef>;
		author?: string;
		tagIds?: Array<string>;
		assignees?: Array<string>;
		access?: Array<AccessEntry> | null;
	},
): Promise<Tracker> {
	const current = await collections();

	const changes: Partial<Tracker> = {
		...patch,
		updatedAt: new Date().toISOString(),
	};
	// A cleared author field is stored as "no author" rather than an empty string.
	if (patch.author !== undefined) changes.author = patch.author || null;
	// With nothing logged yet it stands where it starts, so moving the start
	// moves it; see `deriveCurrentValue`.
	if (
		patch.startValue !== undefined &&
		(await current.entries.countDocuments(
			{ trackerId, userId },
			{ limit: 1 },
		)) === 0
	) {
		changes.currentValue = patch.startValue;
	}

	const next = await current.trackers.findOneAndUpdate(
		{ trackerId, userId },
		{
			$set: changes,
			// Written with a list of its own, it stops being read from the old
			// field; leaving both would mean two answers to the same question.
			...(patch.access === undefined ? {} : { $unset: { visibleTo: "" } }),
		},
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
	await deleteTrackers(userId, [trackerId]);
}

/**
 * Delete several trackers and all their readings at once — a pick of them on
 * the Trackers screen — in a handful of writes for all of them.
 */
export async function deleteTrackers(
	userId: string,
	trackerIds: ReadonlyArray<string>,
): Promise<void> {
	const current = await collections();
	const ids = [...trackerIds];

	const trackers = await current.trackers
		.find(
			{ trackerId: { $in: ids }, userId },
			{
				projection: {
					_id: 0,
					trackerId: 1,
					currentValue: 1,
					targetValue: 1,
					startValue: 1,
				},
			},
		)
		.toArray();
	const reached = new Set(
		trackers
			.filter(
				(tracker) =>
					trackerProgress(
						tracker.currentValue,
						tracker.targetValue,
						tracker.startValue,
					).percent >= 100,
			)
			.map((tracker) => tracker.trackerId),
	);

	await current.entries.deleteMany({ trackerId: { $in: ids }, userId });
	await current.trackers.deleteMany({ trackerId: { $in: ids }, userId });
	await releaseFollowers(
		userId,
		"trackerId",
		ids.filter((id) => reached.has(id)),
		true,
	);
	await releaseFollowers(
		userId,
		"trackerId",
		ids.filter((id) => !reached.has(id)),
		false,
	);
	await clearDependencies(userId, "tracker", ids);
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
		/** Absent or `null` for no time; see `ProgressEntry.recordedTime`. */
		recordedTime?: string | null;
		note: string;
	},
	/**
	 * Who logged it, lower-cased, from the session: in a team, what a person's
	 * share is counted from; see `ProgressEntry.recordedBy`.
	 */
	recordedBy: string,
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
		number: await nextNumber(current, userId, "entry"),
		recordedAt: input.recordedAt,
		recordedTime: input.recordedTime ?? null,
		value: input.value,
		note: input.note,
		recordedBy,
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
	patch: {
		value?: number;
		recordedAt?: string;
		recordedTime?: string | null;
		note?: string;
	},
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

/**
 * Delete several readings at once — a pick of them — in one write, the
 * tracker's figures worked out again once rather than once each. Any already
 * gone are simply skipped.
 */
export async function deleteProgressEntries(
	userId: string,
	trackerId: string,
	entryIds: ReadonlyArray<string>,
): Promise<void> {
	const current = await collections();

	const tracker = await requireTracker(current, userId, trackerId);

	await current.entries.deleteMany({
		entryId: { $in: [...entryIds] },
		trackerId,
		userId,
	});
	await refreshCurrentValue(current, userId, trackerId, tracker.startValue);
}
