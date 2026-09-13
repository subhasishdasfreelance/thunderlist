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

/**
 * Messages Chrome, Firefox and Safari give for a module that cannot be fetched,
 * or that came back as something other than a script — the server's HTML for
 * a file it no longer has.
 */
const CHUNK_LOAD_ERROR =
	/Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to load module script|Unable to preload CSS|Loading (CSS )?chunk .* failed/i;

const RELOADED_AT = "thunderlist.chunk-reload.v1";

/** Failing again this soon after reloading for it means reloading does not help. */
const RELOAD_COOLDOWN_MS = 10_000;

/**
 * Read off anything with a message, not only an `Error`: an error that has
 * crossed from the server or another frame can arrive as a plain object, a
 * bare string, or wrapped by whatever caught it first — so its causes are
 * read too.
 */
export function isChunkLoadError(error: unknown, depth = 0): boolean {
	if (typeof error === "string") return CHUNK_LOAD_ERROR.test(error);
	if (error === null || typeof error !== "object" || depth > 3) return false;

	const { message, cause } = error as { message?: unknown; cause?: unknown };
	return (
		(typeof message === "string" && CHUNK_LOAD_ERROR.test(message)) ||
		isChunkLoadError(cause, depth + 1)
	);
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
