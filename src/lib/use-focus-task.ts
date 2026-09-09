/**
 * Bringing a task named in the URL into view.
 *
 * Arriving from Today's checklist link or from search, the useful thing is not
 * the page but one row on it. This scrolls that row into the middle and lets
 * the ring in `styles.css` say which one it was.
 *
 * It is written as a short-lived loop rather than a single call because two
 * things happen after this effect runs and both undo it: the list is often
 * still loading, so the row does not exist yet, and the router settles its own
 * scroll position as it finishes arriving, which put the page back at the top.
 * So the row is re-asserted every frame until it has held still, and the scroll
 * is instant — a smooth one is still animating when that reset lands and loses.
 */

import { useEffect } from "react";

/** How long to keep trying before assuming the row is never coming. */
const GIVE_UP_AFTER_MS = 3000;

/** Frames the row must stay in view before this stops watching it. */
const SETTLED_FRAMES = 20;

export function useFocusTask(taskId: string | undefined): void {
	useEffect(() => {
		if (!taskId) return;

		const until = performance.now() + GIVE_UP_AFTER_MS;
		let settled = 0;
		let frame = 0;

		const step = () => {
			const row = document.querySelector(`[data-task-id="${taskId}"]`);

			if (row) {
				const box = row.getBoundingClientRect();

				if (box.top >= 0 && box.bottom <= window.innerHeight) {
					settled += 1;
				} else {
					settled = 0;
					row.scrollIntoView({ block: "center", behavior: "auto" });
				}
			}

			if (settled < SETTLED_FRAMES && performance.now() < until) {
				frame = requestAnimationFrame(step);
			}
		};

		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	}, [taskId]);
}
