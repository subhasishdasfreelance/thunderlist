/**
 * What the app keeps in this browser between visits.
 *
 * Only copies of what is saved — the space's own order and groups, so a list
 * opens already in them — never the only copy of anything.
 */

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
