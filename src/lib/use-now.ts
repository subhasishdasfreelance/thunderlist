/**
 * The current time, to the minute, once the browser has it.
 *
 * `null` while the server renders and while the browser hydrates what it sent.
 * The server knows neither the viewer's clock nor their time zone, so anything
 * worked out from "now" on the local clock — how far through a window, whether
 * that is ahead or behind — is drawn by the browser alone, rather than drawn
 * once in the wrong zone and then contradicted a moment later.
 *
 * After that it moves once a minute, which is as fine as any figure it feeds is
 * worth showing. Every component reading it shares the one timer.
 */

import { useSyncExternalStore } from "react";

const MINUTE_MS = 60_000;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	timer ??= setInterval(() => {
		for (const each of listeners) each();
	}, MINUTE_MS);

	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			clearInterval(timer);
			timer = undefined;
		}
	};
}

/** Floored to the minute, so every read within one minute agrees. */
function currentMinute(): number {
	return Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
}

export function useNow(): number | null {
	return useSyncExternalStore(subscribe, currentMinute, () => null);
}
