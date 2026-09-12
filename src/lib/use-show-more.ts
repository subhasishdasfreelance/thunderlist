/**
 * A long list, a page at a time.
 *
 * Past a screen or two a list stops being read and starts being scrolled past,
 * so each one opens on its first twenty rows and grows by twenty on request.
 * It grows rather than turning into numbered pages because the rows above stay
 * put: moving a task up can never send it to a page nobody is looking at.
 *
 * `revealIndex` is a row that is shown whatever the page — the task a `?task=`
 * link was sent to, which `useFocusTask` can only scroll to if it is there.
 */

import { useState } from "react";
import type { TaskPageView } from "#/schemas/task";

/** Rows shown at first, and added each time more are asked for. */
export const PAGE_SIZE = 20;

/**
 * The first page of a list read from the server a page at a time: what its
 * screen opens on, newest first, and what the screen's loader reads ahead.
 */
export function firstPage(reveal?: string): TaskPageView {
	return { sort: "newest", limit: PAGE_SIZE, reveal };
}

export function useShowMore<T>(items: ReadonlyArray<T>, revealIndex = -1) {
	const [limit, setLimit] = useState(PAGE_SIZE);
	const count = Math.max(limit, revealIndex + 1);

	return {
		shown: items.slice(0, count),
		/** Rows past the ones shown. */
		hidden: Math.max(items.length - count, 0),
		showMore: () => setLimit(count + PAGE_SIZE),
		/** Back to the first page, for a different list shown in its place. */
		reset: () => setLimit(PAGE_SIZE),
	};
}
