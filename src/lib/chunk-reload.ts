/**
 * Recovering from a screen whose code could not be fetched.
 *
 * Each screen's code is fetched the first time it is opened. A page left open
 * across a deploy asks for files the server no longer has, and a dropped
 * connection fails the fetch outright; either way the browser reports "Failed
 * to fetch dynamically imported module" — and remembers the failure, so asking
 * again from the same page fails the same way. Loading the page afresh is the
 * fix: it brings the current version, and its files with it.
 */

/** Messages Chrome, Firefox and Safari give for a module that cannot be fetched. */
const CHUNK_LOAD_ERROR =
	/Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

const RELOADED_AT = "thunderlist.chunk-reload.v1";

/** Failing again this soon after reloading for it means reloading does not help. */
const RELOAD_COOLDOWN_MS = 10_000;

export function isChunkLoadError(error: unknown): boolean {
	return error instanceof Error && CHUNK_LOAD_ERROR.test(error.message);
}

/**
 * Reload to pick up the app's current files, unless that was just tried.
 * Returns whether it reloaded.
 *
 * Not while offline: a reload then only trades this page for the offline one,
 * and the app shows its own offline screen until the connection is back. Not
 * without session storage either, since nothing would then stop a reload that
 * keeps failing from looping.
 */
export function reloadForCurrentVersion(): boolean {
	if (!navigator.onLine) return false;

	try {
		const last = Number(sessionStorage.getItem(RELOADED_AT));
		if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
		sessionStorage.setItem(RELOADED_AT, String(Date.now()));
	} catch {
		return false;
	}

	window.location.reload();
	return true;
}
