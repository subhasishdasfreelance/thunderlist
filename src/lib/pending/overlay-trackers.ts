/**
 * Showing queued tracker and progress edits before they reach the database.
 */

import {
	computeVelocity,
	deriveCurrentValue,
	paceStatus,
	trackerProgress,
	withDeltas,
} from "#/lib/progress";
import type { QueuedChange } from "#/schemas/pending";
import type {
	ProgressEntry,
	TrackerDetail,
	TrackerSummary,
} from "#/schemas/tracker";

function summaryFor(
	change: Extract<QueuedChange["change"], { kind: "tracker.create" }>,
	at: string,
): TrackerSummary {
	return {
		trackerId: change.trackerId,
		title: change.title,
		type: change.type,
		description: change.description,
		unit: change.unit,
		targetValue: change.targetValue,
		currentValue: 0,
		coverUrl: change.coverUrl,
		author: change.author === "" ? null : change.author,
		startDate: change.startDate,
		deadline: change.deadline,
		createdAt: at,
		updatedAt: at,
		// The tracker is created when the batch is applied.
		progress: { current: 0, target: change.targetValue, percent: 0 },
		status: null,
	};
}

/** Recompute everything derived from a tracker's current value. */
function settle(tracker: TrackerSummary, current: number): TrackerSummary {
	const progress = trackerProgress(current, tracker.targetValue);

	return {
		...tracker,
		currentValue: current,
		progress,
		status:
			tracker.targetValue > 0
				? paceStatus({
						startDate: tracker.startDate,
						deadline: tracker.deadline,
						fractionComplete: current / tracker.targetValue,
					})
				: null,
	};
}

/**
 * The tracker list with the queue applied.
 *
 * The list has no history, only the denormalised current value, so a queued
 * reading is treated as the new current value. Back-dating a reading behind an
 * existing one is the case this cannot see; opening the tracker, which does
 * read the history, shows it correctly.
 */
export function overlayTrackers(
	trackers: ReadonlyArray<TrackerSummary>,
	queued: ReadonlyArray<QueuedChange>,
): Array<TrackerSummary> {
	let result = [...trackers];

	const replace = (
		trackerId: string,
		update: (tracker: TrackerSummary) => TrackerSummary,
	) => {
		result = result.map((tracker) =>
			tracker.trackerId === trackerId ? update(tracker) : tracker,
		);
	};

	for (const { change, queuedAt } of queued) {
		switch (change.kind) {
			case "tracker.create":
				result = [...result, summaryFor(change, queuedAt)];
				break;

			case "tracker.update":
				replace(change.trackerId, (tracker) =>
					settle(
						{
							...tracker,
							...change.patch,
							author:
								change.patch.author === undefined
									? tracker.author
									: change.patch.author || null,
						},
						tracker.currentValue,
					),
				);
				break;

			case "tracker.delete":
				result = result.filter(
					(tracker) => tracker.trackerId !== change.trackerId,
				);
				break;

			case "entry.create":
				replace(change.trackerId, (tracker) => settle(tracker, change.value));
				break;

			case "entry.update":
				if (change.patch.value !== undefined) {
					const value = change.patch.value;
					replace(change.trackerId, (tracker) => settle(tracker, value));
				}
				break;

			default:
				break;
		}
	}

	return result;
}

/**
 * One tracker with the queue applied.
 *
 * The full history is here, so deltas, current value, pace and velocity are all
 * recomputed rather than approximated — a back-dated reading lands in the right
 * place and re-spaces its neighbours, exactly as the write will.
 */
export function overlayTrackerDetail(
	detail: TrackerDetail,
	queued: ReadonlyArray<QueuedChange>,
): TrackerDetail {
	let tracker: TrackerSummary = detail;
	let entries: Array<ProgressEntry> = [...detail.entries];

	for (const { change, queuedAt } of queued) {
		switch (change.kind) {
			case "tracker.update":
				if (change.trackerId === tracker.trackerId) {
					tracker = {
						...tracker,
						...change.patch,
						author:
							change.patch.author === undefined
								? tracker.author
								: change.patch.author || null,
					};
				}
				break;

			case "entry.create":
				if (change.trackerId === tracker.trackerId) {
					entries = [
						...entries,
						{
							entryId: change.entryId,
							recordedAt: change.recordedAt,
							value: change.value,
							// Re-derived below from where this lands in the history.
							delta: 0,
							note: change.note,
							updatedAt: queuedAt,
						},
					];
				}
				break;

			case "entry.update":
				if (change.trackerId === tracker.trackerId) {
					entries = entries.map((entry) =>
						entry.entryId === change.entryId
							? { ...entry, ...change.patch, updatedAt: queuedAt }
							: entry,
					);
				}
				break;

			case "entry.delete":
				if (change.trackerId === tracker.trackerId) {
					entries = entries.filter((entry) => entry.entryId !== change.entryId);
				}
				break;

			default:
				break;
		}
	}

	const history = withDeltas(entries);
	const current = deriveCurrentValue(history);
	const settled = settle(tracker, current);

	return {
		...settled,
		entries: history,
		velocity: computeVelocity({
			startDate: settled.startDate,
			deadline: settled.deadline,
			current,
			target: settled.targetValue,
		}),
	};
}

/**
 * A tracker that exists only in the queue.
 *
 * Creating a tracker navigates straight into it so progress can be logged, but
 * the database has never heard of it, so there is nothing to fetch and lay the
 * queue over. This builds the whole thing from the queue instead, and returns
 * `null` when the id really is unknown.
 */
export function pendingTrackerDetail(
	trackerId: string,
	queued: ReadonlyArray<QueuedChange>,
): TrackerDetail | null {
	const created = queued.find(
		(entry) =>
			entry.change.kind === "tracker.create" &&
			entry.change.trackerId === trackerId,
	);

	if (!created || created.change.kind !== "tracker.create") return null;

	const summary = summaryFor(created.change, created.queuedAt);

	return overlayTrackerDetail(
		{
			...summary,
			entries: [],
			velocity: computeVelocity({
				startDate: summary.startDate,
				deadline: summary.deadline,
				current: 0,
				target: summary.targetValue,
			}),
		},
		queued,
	);
}
