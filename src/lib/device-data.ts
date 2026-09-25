/**
 * What the app keeps in this browser between visits, and clearing it.
 *
 * Only ways of looking — the order each list is shown in, the space's own
 * order and groups so a list opens already in them — and the installed app's
 * copy of the last pages it opened. None of it is the only copy of anything:
 * cleared, each list opens in its default order until the space's arrangement
 * has been read again. The colour scheme is kept too, but it has a switch of
 * its own and is left alone here.
 */

const PREFIX = "thunderlist.";
/** The colour scheme's key; see `src/lib/theme.ts`. */
const KEPT = new Set(["thunderlist.theme.v1"]);
/** The installed app's copy of pages; see `public/sw.js`. */
const PAGES_CACHE = "thunderlist-pages-v1";

/** A value kept in this browser, or `null` — also when there is no storage. */
export function readStored(key: string): string | null {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

/** Keep a value; with no storage — a private window — it lasts this visit. */
export function writeStored(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// Nothing to keep it in.
	}
}

export function forgetStored(key: string): void {
	try {
		window.localStorage.removeItem(key);
	} catch {
		// Nothing was kept.
	}
}

/** Everything `clearDeviceData` would clear, by key. */
export function storedKeys(): Array<string> {
	try {
		return Object.keys(window.localStorage).filter(
			(key) => key.startsWith(PREFIX) && !KEPT.has(key),
		);
	} catch {
		return [];
	}
}

/** Clear what this browser keeps for the app, but for the colour scheme. */
export async function clearDeviceData(): Promise<void> {
	for (const key of storedKeys()) forgetStored(key);
	if ("caches" in window) await caches.delete(PAGES_CACHE);
}
