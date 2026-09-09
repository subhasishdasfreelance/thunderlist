/**
 * Rows that slide to their new place instead of jumping to it.
 *
 * Moving a task up or down is the one change where *where it went* is the whole
 * point, and a list that re-paints in its new order tells you an order changed
 * without showing you the move. So the rows are measured before the browser
 * paints, and any that have shifted are handed the distance they travelled;
 * `.thunderlist-row[data-moved]` animates that offset away, which reads as the
 * row sliding from where it was.
 *
 * This is the FLIP trick, kept small: the animation is CSS, and all this does is
 * supply the "first" half of it. Rows that were not on screen a moment ago are
 * left alone — they are arriving, not moving, and already have an animation of
 * their own.
 */

import { useLayoutEffect, useRef } from "react";

/** The custom property `thunderlist-settle` reads its start value from. */
const OFFSET_PROPERTY = "--thunderlist-moved-by";

/** Below this a "move" is a rounding error, and animating it only flickers. */
const MIN_SHIFT_PX = 2;

export function useReorderAnimation(
	container: React.RefObject<HTMLElement | null>,
	/** Changes whenever the order might have: the ids, in order. */
	order: string,
): void {
	const previous = useRef({ order: "", tops: new Map<string, number>() });

	useLayoutEffect(() => {
		const root = container.current;
		if (!root) return;
		if (previous.current.order === order) return;

		const rows = [...root.querySelectorAll<HTMLElement>("[data-task-id]")];
		const before = previous.current.tops;
		const after = new Map<string, number>();

		for (const row of rows) {
			const id = row.dataset.taskId;
			if (id === undefined) continue;

			// `offsetTop`, not the viewport rectangle: scrolling would otherwise
			// look like every row moving at once.
			const top = row.offsetTop;
			after.set(id, top);

			const was = before.get(id);
			if (was === undefined) continue;

			const shift = was - top;
			if (Math.abs(shift) < MIN_SHIFT_PX) continue;

			row.style.setProperty(OFFSET_PROPERTY, `${shift}px`);
			row.dataset.moved = "";

			row.addEventListener(
				"animationend",
				() => {
					row.style.removeProperty(OFFSET_PROPERTY);
					delete row.dataset.moved;
				},
				{ once: true },
			);
		}

		previous.current = { order, tops: after };
	}, [container, order]);
}
