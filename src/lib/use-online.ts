/**
 * Whether the browser has a connection, as the browser reports it.
 *
 * `true` while the server renders and while the browser hydrates what it sent,
 * which is how it almost always is; the browser's own answer follows at once.
 */

import { useSyncExternalStore } from "react";

function subscribe(listener: () => void): () => void {
	window.addEventListener("online", listener);
	window.addEventListener("offline", listener);

	return () => {
		window.removeEventListener("online", listener);
		window.removeEventListener("offline", listener);
	};
}

export function useIsOnline(): boolean {
	return useSyncExternalStore(
		subscribe,
		() => navigator.onLine,
		() => true,
	);
}
