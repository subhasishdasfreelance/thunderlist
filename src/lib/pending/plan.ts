/**
 * Scheduling a batch of queued changes.
 *
 * Applying changes one at a time costs a network round trip each, and a batch
 * is mostly changes that have nothing to do with one another — pasting twenty
 * tasks into one checklist is twenty independent inserts. This works out which
 * of them can go out together.
 *
 * Pure: it decides the shape of the work, it does not do any of it.
 */

import type { PendingChange } from "#/schemas/pending";

/**
 * How many changes may be in flight at once.
 *
 * Five is deliberately conservative. A hosted cluster is a shared, metered
 * thing, and a save that trips a rate limit is slower than one that never tried
 * — while five is already enough to hide most of the round-trip latency. The
 * browser sends the batch five at a time and reports progress between them, so
 * this is also the size of one visible step.
 */
export const MAX_IN_FLIGHT = 5;

/**
 * What a change writes, and whether it needs the key to itself.
 *
 * `exclusive` is the whole point of the distinction. Creating a checklist and
 * writing a task in it both concern that checklist, but twenty tasks in the
 * same checklist do not concern *each other* — so the lifecycle of a container
 * claims it exclusively while the things inside it claim it shared, and the
 * twenty inserts go out together.
 */
type Claim = { key: string; exclusive: boolean };

const shared = (key: string): Claim => ({ key, exclusive: false });
const exclusive = (key: string): Claim => ({ key, exclusive: true });

/** Claimed by a change that can reach any document. */
const EVERYTHING = "*";

const checklistKey = (id: string) => `chk:${id}`;
const taskKey = (id: string) => `tsk:${id}`;
const trackerKey = (id: string) => `trk:${id}`;
const entryKey = (id: string) => `ent:${id}`;
const listKey = (name: string) => `list:${name}`;

/** A reference is keyed by what it points at, not by the task document. */
const refKey = (checklistId: string, taskId: string) =>
	`ref:${checklistId}:${taskId}`;

/**
 * The tracker total, which every reading rewrites.
 *
 * `currentValue` is recomputed by reading the whole history back, so two
 * readings landing at once could each recompute from a different view of it.
 * They take this key exclusively; readings on *different* trackers still go out
 * together.
 */
const trackerTotalKey = (id: string) => `trkval:${id}`;

/**
 * What each change writes.
 *
 * The conservative entries are the ones that matter: deleting a task also
 * clears the references to it, deleting a checklist clears its tasks and their
 * references, and deleting a tag rewrites every task carrying it.
 */
function writes(change: PendingChange): Array<Claim> {
	switch (change.kind) {
		// Held exclusively so nothing writes a task into a checklist that does not
		// exist yet, or into one that has just been removed along with its tasks.
		case "checklist.create":
		case "checklist.update":
		case "checklist.delete":
			return [exclusive(checklistKey(change.checklistId))];

		case "task.create":
		case "task.update":
			return [
				shared(checklistKey(change.checklistId)),
				exclusive(taskKey(change.taskId)),
			];
		// Also clears the Today or Backlog reference pointing at it.
		case "task.delete":
			return [
				shared(checklistKey(change.checklistId)),
				exclusive(taskKey(change.taskId)),
				exclusive(refKey(change.checklistId, change.taskId)),
			];

		case "tracker.create":
		case "tracker.update":
		case "tracker.delete":
			return [exclusive(trackerKey(change.trackerId))];

		case "entry.create":
		case "entry.update":
		case "entry.delete":
			return [
				shared(trackerKey(change.trackerId)),
				exclusive(trackerTotalKey(change.trackerId)),
				exclusive(entryKey(change.entryId)),
			];

		/**
		 * Adding takes the task off the other list, so both are claimed — but
		 * only for this one task, which is what lets a pasted list of references
		 * go out together. A position of zero means "put it at the end", which
		 * has to read the list first, so that case claims the list exclusively.
		 */
		case "ref.add":
			return [
				shared(checklistKey(change.checklistId)),
				exclusive(refKey(change.checklistId, change.taskId)),
				change.sortOrder > 0
					? shared(listKey(change.list))
					: exclusive(listKey(change.list)),
				shared(listKey(change.list === "today" ? "backlog" : "today")),
			];
		case "ref.remove":
			return [shared(listKey(change.list)), exclusive(`itm:${change.itemId}`)];
		// Swaps two positions, having read the whole list to find them.
		case "ref.move":
			return [exclusive(listKey(change.list))];

		// Both check that the name is not already taken, which reads every tag.
		case "tag.create":
		case "tag.update":
			return [exclusive("tags")];
		// Strips the id from every task carrying it, in any checklist.
		case "tag.delete":
			return [exclusive(EVERYTHING)];
	}
}

/** The keys a run has claimed so far, and how. */
class Claimed {
	private readonly exclusive = new Set<string>();
	private readonly shared = new Set<string>();

	/** Only ever asked of a run that already holds something. */
	conflictsWith(claims: ReadonlyArray<Claim>): boolean {
		// A change that can reach anything conflicts with whatever is already
		// there, and nothing may join it afterwards.
		if (this.exclusive.has(EVERYTHING)) return true;
		if (claims.some((claim) => claim.key === EVERYTHING)) return true;

		return claims.some((claim) =>
			claim.exclusive
				? this.exclusive.has(claim.key) || this.shared.has(claim.key)
				: this.exclusive.has(claim.key),
		);
	}

	add(claims: ReadonlyArray<Claim>): void {
		for (const claim of claims) {
			if (claim.exclusive) this.exclusive.add(claim.key);
			else this.shared.add(claim.key);
		}
	}
}

/**
 * Split a batch into runs that can each go out concurrently.
 *
 * A run grows for as long as no two changes in it write to the same place. That
 * keeps ordering exactly where it is needed — a task added to a checklist
 * created moments earlier lands in a later run than the checklist — and drops
 * it everywhere it is not.
 *
 * Runs stay in order and a change never moves past one it might depend on, so
 * the result replays the batch exactly as the user built it. Because runs are
 * contiguous, the count of changes before a run is still a prefix of the batch,
 * which is what `applyChanges` reports back.
 */
export function planRuns(
	changes: ReadonlyArray<PendingChange>,
): Array<Array<PendingChange>> {
	const runs: Array<Array<PendingChange>> = [];
	let current: Array<PendingChange> = [];
	let claimed = new Claimed();

	const flush = () => {
		if (current.length === 0) return;
		runs.push(current);
		current = [];
		claimed = new Claimed();
	};

	for (const change of changes) {
		const claims = writes(change);

		if (current.length > 0 && claimed.conflictsWith(claims)) flush();

		current.push(change);
		claimed.add(claims);

		if (current.length === MAX_IN_FLIGHT) flush();
	}

	flush();
	return runs;
}
