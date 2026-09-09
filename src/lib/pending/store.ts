/**
 * The pending-changes queue.
 *
 * Every edit lands here first and only reaches the database when the user
 * confirms the batch. Collecting them turns a dozen scattered writes into one
 * deliberate save the user has seen and agreed to.
 *
 * The queue is held in `localStorage` so closing the tab does not lose work.
 * It is intentionally a plain ordered list: the order the user made the changes
 * in is the order they have to be replayed in, because a later change can
 * depend on an earlier one.
 */

import { useSyncExternalStore } from "react";
import { createId, ID_PREFIX } from "#/lib/ids";
import type { PendingChange, QueuedChange } from "#/schemas/pending";

const STORAGE_KEY = "thunderlist.pending.v1";

/** A stable empty array, so the server snapshot never changes identity. */
const EMPTY: ReadonlyArray<QueuedChange> = [];

let queue: ReadonlyArray<QueuedChange> = EMPTY;
let isHydrated = false;
const listeners = new Set<() => void>();

function isBrowser(): boolean {
	return typeof window !== "undefined";
}

/**
 * Anything unreadable is discarded rather than thrown.
 *
 * A corrupt queue would otherwise break every screen at once, and there is no
 * sensible repair: the changes it described are already lost.
 */
function readStorage(): ReadonlyArray<QueuedChange> {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return EMPTY;

		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return EMPTY;

		return parsed.filter(
			(entry): entry is QueuedChange =>
				typeof entry === "object" &&
				entry !== null &&
				typeof (entry as QueuedChange).id === "string" &&
				typeof (entry as QueuedChange).change === "object",
		);
	} catch {
		return EMPTY;
	}
}

function writeStorage(next: ReadonlyArray<QueuedChange>): void {
	try {
		if (next.length === 0) window.localStorage.removeItem(STORAGE_KEY);
		else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// A full or blocked storage must not stop the edit being made; the queue
		// simply falls back to lasting only as long as the tab does.
	}
}

function emit(): void {
	for (const listener of listeners) listener();
}

function setQueue(next: ReadonlyArray<QueuedChange>): void {
	queue = next;
	writeStorage(next);
	emit();
}

function hydrate(): void {
	if (isHydrated || !isBrowser()) return;
	isHydrated = true;

	const stored = readStorage();
	if (stored.length > 0) {
		queue = stored;
		emit();
	}
}

function subscribe(listener: () => void): () => void {
	hydrate();
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot(): ReadonlyArray<QueuedChange> {
	return queue;
}

/**
 * The server renders no queue at all.
 *
 * `localStorage` does not exist there, and pretending otherwise would make the
 * first client render disagree with the markup it is hydrating.
 */
function getServerSnapshot(): ReadonlyArray<QueuedChange> {
	return EMPTY;
}

/** The queued changes, oldest first. Re-renders whenever the queue changes. */
export function usePendingChanges(): ReadonlyArray<QueuedChange> {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export type QueueInput = {
	/** Written now, while the screen still knows the titles involved. */
	label: string;
	change: PendingChange;
	/** Display data for a change that references something Today cannot resolve yet. */
	preview?: QueuedChange["preview"];
};

export function enqueue(input: QueueInput): void {
	hydrate();

	setQueue([
		...queue,
		{
			id: createId(ID_PREFIX.change),
			queuedAt: new Date().toISOString(),
			label: input.label,
			preview: input.preview,
			change: input.change,
		},
	]);
}

export function discard(id: string): void {
	hydrate();
	setQueue(queue.filter((entry) => entry.id !== id));
}

export function discardAll(): void {
	hydrate();
	setQueue(EMPTY);
}

/**
 * Drop the changes that were written, keeping the rest queued.
 *
 * A batch can stop part way through, so the browser is told how many went in
 * rather than assuming all or nothing. Dropping from the front matches the
 * order they were replayed in.
 */
export function dropApplied(count: number): void {
	hydrate();
	if (count <= 0) return;
	setQueue(queue.slice(count));
}
