/**
 * A long list, a page at a time.
 *
 * Past a screen or two a list stops being read and starts being scrolled past,
 * so every list is shown twenty rows a page, with the pages numbered, so any
 * one of them is a click away rather than a trail of "show more".
 *
 * The lists that are long on the server — a checklist's stages, a tag's open
 * tasks — are read from it a page at a time; see `pageOf`. The ones already
 * whole in the browser page themselves with `usePages`.
 */

import { useState } from "react";
import type { TaskPageView } from "#/schemas/task";

/** Rows on a page. */
export const PAGE_SIZE = 20;

/**
 * The page of a list read from the server a page at a time that its screen
 * opens on, newest first: the one holding `reveal`, or the first. What the
 * screen's loader reads ahead.
 */
export function firstPage(reveal?: string): TaskPageView {
	return { sort: "newest", limit: PAGE_SIZE, reveal };
}

/**
 * A list already in the browser, a page at a time.
 *
 * `revealIndex` is a row whose page is opened on until another is picked — the
 * task a `?task=` link was sent to, which `useFocusTask` can only scroll to if
 * it is there. A page past the end, after rows have gone, is the last one.
 */
export function usePages<T>(items: ReadonlyArray<T>, revealIndex = -1) {
	const [chosen, setChosen] = useState<number | null>(null);

	const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
	const wanted =
		chosen ??
		(revealIndex === -1 ? 1 : Math.floor(revealIndex / PAGE_SIZE) + 1);
	const page = Math.min(Math.max(wanted, 1), pageCount);

	return {
		page,
		total: items.length,
		shown: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
		setPage: setChosen,
		/** Back to the first page, for a different list shown in its place. */
		reset: () => setChosen(null),
	};
}
