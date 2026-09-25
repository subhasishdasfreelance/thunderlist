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
 *
 * It runs again on every arrival, not only when the task changes: searching
 * for a task on the page already open — even the same task twice — is a new
 * arrival with the same address, and has to scroll and ring it all the same.
 */

import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * How long to keep trying before assuming the row is never coming. Long
 * enough for a slow answer: the page holding the task, or the finished tasks
 * it is among, may still be on its way.
 */
const GIVE_UP_AFTER_MS = 10_000;

/** Frames the row must stay in view before this stops watching it. */
const SETTLED_FRAMES = 20;

/**
 * Which arrival this is: a new value on every navigation, the same address
 * again included, since each is a history entry of its own.
 */
export function useArrival(): string {
	return useRouterState({
		select: (state) => {
			const held = state.location.state as { __TSR_key?: string; key?: string };
			return held.__TSR_key ?? held.key ?? state.location.href;
		},
	});
}

export function useFocusTask(taskId: string | undefined): void {
	const arrival = useArrival();

	// biome-ignore lint/correctness/useExhaustiveDependencies: `arrival` is what makes the same task, searched for again, a fresh arrival.
	useEffect(() => {
		if (!taskId) return;

		const until = performance.now() + GIVE_UP_AFTER_MS;
		let settled = 0;
		let frame = 0;
		let hasRung = false;

		const step = () => {
			const found = document.querySelector<HTMLElement>(
				`[data-task-id="${taskId}"]`,
			);
			// A row in a folded section is there but not yet on show; it is
			// waited for until its section has opened.
			const row = found?.closest("[inert]") ? null : found;

			if (row) {
				// The ring plays once per arrival: restarted, so a row already
				// ringed from the last one rings again.
				if (!hasRung) {
					hasRung = true;
					row.style.animation = "none";
					void row.offsetWidth;
					row.style.animation = "";
				}

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
	}, [taskId, arrival]);
}
