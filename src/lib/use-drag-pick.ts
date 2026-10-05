import { useEffect, useRef } from "react";
import type { PickedRow } from "#/lib/use-task-selection";

/** How long a finger rests on a row before dragging picks rather than scrolls. */
const HOLD_MS = 400;

/** How far a finger may wander while resting and still be resting, in px. */
const SLOP = 10;

/** How near the top or foot of the screen a drag scrolls the page, in px. */
const EDGE = 80;

/** The rows of one kind on screen, in the order they are drawn. */
function rowsOf(kind: PickedRow): Array<HTMLElement> {
	return [...document.querySelectorAll<HTMLElement>(`[data-${kind}-id]`)];
}

function idOf(row: HTMLElement, kind: PickedRow): string | undefined {
	return row.dataset[`${kind}Id`];
}

/** The ids of every row of one kind on screen: what "Select all" picks. */
export function idsOnScreen(kind: PickedRow): Array<string> {
	return rowsOf(kind).flatMap((row) => idOf(row, kind) ?? []);
}

/**
 * Picking a run of rows by dragging over them: from the row the drag started
 * on to the one under the pointer now, and everything between.
 *
 * On a touch screen it starts by resting a finger on a row for a moment, so a
 * plain swipe still scrolls; from then on the page holds still under the
 * finger, and scrolls by itself near the top or foot of the screen to reach
 * rows further on. The phone's own text selection is not used: it cannot be
 * stretched from one row to the next reliably.
 *
 * With `withMouse`, a mouse does the same by pressing on one row and moving
 * onto another — for cards, which are links, where a drag would otherwise
 * drag the link. Tasks leave the mouse to the text selection; see
 * `useTaskSelection`.
 *
 * The press that ends a drag does not go on to open what it ended on.
 */
export function useDragPick({
	kind,
	onPick,
	withMouse = false,
	isEnabled = true,
}: {
	kind: PickedRow;
	/** The ids dragged over, in the order they are drawn. */
	onPick: (ids: Array<string>) => void;
	withMouse?: boolean;
	isEnabled?: boolean;
}): void {
	// The latest, so the listeners need not be set up again on every render.
	const pick = useRef(onPick);
	pick.current = onPick;

	useEffect(() => {
		if (!isEnabled) return;
		const ROW = `[data-${kind}-id]`;

		// Where the press started, and where the pointer is now.
		let start: { id: string; x: number; y: number } | null = null;
		let at = { x: 0, y: 0 };
		let isDragging = false;
		let hold: ReturnType<typeof setTimeout> | undefined;
		let scrolling: number | undefined;
		// The click that ends a drag, kept from opening what it lands on.
		let swallowClick = false;

		function rowAt(x: number, y: number): HTMLElement | null {
			return document.elementFromPoint(x, y)?.closest<HTMLElement>(ROW) ?? null;
		}

		function pickTo(x: number, y: number) {
			if (start === null) return;
			const row = rowAt(x, y);
			if (row === null) return;
			const ids = rowsOf(kind).map((each) => idOf(each, kind) ?? "");
			const from = ids.indexOf(start.id);
			const to = ids.indexOf(idOf(row, kind) ?? "");
			if (from < 0 || to < 0) return;
			pick.current(ids.slice(Math.min(from, to), Math.max(from, to) + 1));
		}

		/** Scrolls while the pointer rests near the top or foot of the screen. */
		function scrollNearEdges() {
			const by =
				at.y < EDGE
					? -Math.ceil((EDGE - at.y) / 8)
					: at.y > window.innerHeight - EDGE
						? Math.ceil((at.y - (window.innerHeight - EDGE)) / 8)
						: 0;
			if (by !== 0) {
				window.scrollBy(0, by);
				pickTo(at.x, at.y);
			}
			scrolling = requestAnimationFrame(scrollNearEdges);
		}

		function begin() {
			isDragging = true;
			document.getSelection()?.removeAllRanges();
			if (start !== null) pickTo(start.x, start.y);
			scrolling = requestAnimationFrame(scrollNearEdges);
		}

		function end() {
			if (isDragging) swallowClick = true;
			clearTimeout(hold);
			if (scrolling !== undefined) cancelAnimationFrame(scrolling);
			start = null;
			isDragging = false;
			scrolling = undefined;
		}

		function press(target: EventTarget | null, x: number, y: number) {
			if (!(target instanceof Element)) return false;
			if (target.closest("dialog, [role='dialog']")) return false;
			const row = target.closest<HTMLElement>(ROW);
			const id = row === null ? undefined : idOf(row, kind);
			if (id === undefined) return false;
			start = { id, x, y };
			at = { x, y };
			return true;
		}

		function onTouchStart(event: TouchEvent) {
			end();
			if (event.touches.length !== 1) return;
			const touch = event.touches[0];
			if (press(event.target, touch.clientX, touch.clientY)) {
				hold = setTimeout(begin, HOLD_MS);
			}
		}

		function onTouchMove(event: TouchEvent) {
			if (start === null) return;
			const touch = event.touches[0];
			at = { x: touch.clientX, y: touch.clientY };
			if (isDragging) {
				// The page holds still under the finger while it picks.
				event.preventDefault();
				pickTo(at.x, at.y);
			} else if (Math.hypot(at.x - start.x, at.y - start.y) > SLOP) {
				// Moving before the hold is up is a scroll.
				end();
			}
		}

		function onPointerDown(event: PointerEvent) {
			if (event.pointerType !== "mouse" || event.button !== 0) return;
			end();
			press(event.target, event.clientX, event.clientY);
		}

		function onPointerMove(event: PointerEvent) {
			if (event.pointerType !== "mouse" || start === null) return;
			at = { x: event.clientX, y: event.clientY };
			if (!isDragging) {
				const row = rowAt(at.x, at.y);
				if (row === null || idOf(row, kind) === start.id) return;
				begin();
			}
			pickTo(at.x, at.y);
		}

		function onPointerUp(event: PointerEvent) {
			if (event.pointerType === "mouse") end();
		}

		// Any new press is a fresh start, however the last one ended.
		function onAnyPointerDown() {
			swallowClick = false;
		}

		function onClick(event: MouseEvent) {
			if (!swallowClick) return;
			swallowClick = false;
			event.preventDefault();
			event.stopPropagation();
		}

		// A long press on a row is the start of a pick, not the phone's menu.
		function onContextMenu(event: Event) {
			if (start !== null) event.preventDefault();
		}

		// A card is a link: pressing and moving would drag the link away.
		function onDragStart(event: DragEvent) {
			if (event.target instanceof Element && event.target.closest(ROW)) {
				event.preventDefault();
			}
		}

		function onSelectStart(event: Event) {
			if (start !== null) event.preventDefault();
		}

		const options = { passive: false } as const;
		document.addEventListener("touchstart", onTouchStart, { passive: true });
		document.addEventListener("touchmove", onTouchMove, options);
		document.addEventListener("touchend", end);
		document.addEventListener("touchcancel", end);
		document.addEventListener("contextmenu", onContextMenu);
		document.addEventListener("pointerdown", onAnyPointerDown, true);
		document.addEventListener("click", onClick, true);
		if (withMouse) {
			document.addEventListener("pointerdown", onPointerDown);
			document.addEventListener("pointermove", onPointerMove);
			document.addEventListener("pointerup", onPointerUp);
			document.addEventListener("dragstart", onDragStart);
			document.addEventListener("selectstart", onSelectStart);
		}
		return () => {
			end();
			document.removeEventListener("touchstart", onTouchStart);
			document.removeEventListener("touchmove", onTouchMove);
			document.removeEventListener("touchend", end);
			document.removeEventListener("touchcancel", end);
			document.removeEventListener("contextmenu", onContextMenu);
			document.removeEventListener("pointerdown", onAnyPointerDown, true);
			document.removeEventListener("click", onClick, true);
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("pointermove", onPointerMove);
			document.removeEventListener("pointerup", onPointerUp);
			document.removeEventListener("dragstart", onDragStart);
			document.removeEventListener("selectstart", onSelectStart);
		};
	}, [kind, withMouse, isEnabled]);
}
