import { useCallback, useEffect, useRef, useState } from "react";
import { idsOnScreen, useDragPick } from "#/lib/use-drag-pick";
import { isTyping } from "#/lib/use-row-shortcuts";

/**
 * What can be picked out: tasks, or a tracker's readings, or the things on
 * an index screen — checklists, trackers, tags, plans, countdowns. Each row
 * carries its id as `data-task-id`, `data-entry-id` or `data-item-id`.
 */
export type PickedRow = "task" | "entry" | "item";

/** Places whose arrow keys are their own: a dialog, a menu, tabs, a list box. */
const OWN_ARROWS =
	'dialog, [role="dialog"], [role="menu"], [role="listbox"], [role="tablist"], [role="radiogroup"], [role="slider"]';

/** The parts of a row that do something of their own when clicked. */
const OWN_CLICKS =
	'a, button, input, label, select, textarea, [role="button"], [role="checkbox"], [role="menuitem"]';

/** No task picked. One set, so clearing twice draws nothing again. */
const NONE: ReadonlySet<string> = new Set();

/** The first row at least partly on screen, or the first row. */
function firstInView(rows: ReadonlyArray<HTMLElement>): number {
	const index = rows.findIndex((row) => {
		const { top, bottom } = row.getBoundingClientRect();
		return bottom > 0 && top < window.innerHeight;
	});
	return Math.max(index, 0);
}

/**
 * The tasks a text selection runs across, or the arrow keys walk over.
 *
 * Dragging over a few rows to copy what they say is already how several tasks
 * get picked out of a list, so the rows a selection touches — even one word of
 * one — are taken as picked: drawn with a wash, and moved on together from the
 * bar that comes up; see `SelectionBar`. On a phone, the same comes from
 * resting a finger on a row and dragging over the others; see `useDragPick`.
 * `pickAll` picks every row on screen.
 *
 * From the keyboard, Down and Up pick the next or previous row — starting at
 * the row under the pointer, or the first on screen — and with Shift held they
 * stretch the pick from where it started. Then a key in the bar moves them
 * all on; see `SelectionBar`.
 *
 * The pick outlives the text selection it came from, and each new drag adds
 * to it: select a few rows, then drag over more further down, and all of them
 * are picked. While anything is picked, clicking or tapping a row — not one of
 * its buttons — picks it or lets it go, one at a time, as the cards' picking
 * does; see `usePickMode`. Selecting text elsewhere leaves it be. It ends
 * only with `clear` — the bar's close button, or Escape — which lets go of the
 * text selection over the rows too, so nothing is left highlighted as if
 * still picked.
 */
export function useTaskSelection(kind: PickedRow = "task"): {
	picked: ReadonlySet<string>;
	clear: () => void;
	pickAll: () => void;
} {
	const [picked, setPicked] = useState(NONE);
	// What was picked before the current drag began; the drag adds to it.
	const pickedNow = useRef(picked);
	pickedNow.current = picked;
	const before = useRef(NONE);
	// Where a keyboard pick started, and the row it has reached.
	const anchor = useRef<string | null>(null);
	const cursor = useRef<string | null>(null);

	/** These rows picked as well, the arrow keys carrying on from them. */
	const pickRows = useCallback((ids: Array<string>) => {
		if (ids.length === 0) return;
		anchor.current = ids[0];
		cursor.current = ids.at(-1) ?? null;
		const next = new Set([...before.current, ...ids]);
		setPicked((current) =>
			current.size === next.size && [...next].every((id) => current.has(id))
				? current
				: next,
		);
	}, []);

	const clear = useCallback(() => {
		anchor.current = null;
		cursor.current = null;
		before.current = NONE;
		setPicked(NONE);

		const selection = document.getSelection();
		if (selection === null || selection.isCollapsed) return;
		if (selection.rangeCount === 0) return;
		const range = selection.getRangeAt(0);
		const rows = document.querySelectorAll(`[data-${kind}-id]`);
		if ([...rows].some((row) => range.intersectsNode(row))) {
			selection.removeAllRanges();
		}
	}, [kind]);

	const pickAll = useCallback(
		() => pickRows(idsOnScreen(kind)),
		[kind, pickRows],
	);

	useDragPick({ kind, onPick: pickRows });

	useEffect(() => {
		const ROW = `[data-${kind}-id]`;
		const idOf = (row: HTMLElement) => row.dataset[`${kind}Id`];

		function onSelectionChange() {
			const selection = document.getSelection();
			if (selection === null || selection.isCollapsed) return;
			if (selection.rangeCount === 0) return;

			const range = selection.getRangeAt(0);
			pickRows(
				[...document.querySelectorAll<HTMLElement>(ROW)]
					.filter((row) => range.intersectsNode(row))
					.flatMap((row) => idOf(row) ?? []),
			);
		}

		// A press may start a new drag, which adds to what is already picked.
		function onPointerDown() {
			before.current = pickedNow.current;
		}

		// While anything is picked, a click on a row picks it or lets it go. The
		// click that ends a drag over text, or a double click, is left alone.
		function onClick(event: MouseEvent) {
			if (pickedNow.current.size === 0) return;
			if (event.defaultPrevented || event.button !== 0 || event.detail > 1) {
				return;
			}
			if (!(event.target instanceof Element)) return;
			if (event.target.closest(OWN_CLICKS)) return;
			const row = event.target.closest<HTMLElement>(ROW);
			const id = row === null ? undefined : idOf(row);
			if (id === undefined) return;
			const selection = document.getSelection();
			if (selection !== null && !selection.isCollapsed) return;

			setPicked((current) => {
				const next = new Set(current);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return next;
			});
		}

		function walk(event: KeyboardEvent) {
			const by = event.key === "ArrowDown" ? 1 : -1;
			if (event.defaultPrevented) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isTyping(event.target)) return;
			if (event.target instanceof Element && event.target.closest(OWN_ARROWS)) {
				return;
			}
			if (document.querySelector("dialog[open]") !== null) return;

			const rows = [...document.querySelectorAll<HTMLElement>(ROW)];
			if (rows.length === 0) return;
			const ids = rows.map((row) => idOf(row) ?? "");

			const at = cursor.current === null ? -1 : ids.indexOf(cursor.current);
			let next: number;
			if (at >= 0) {
				next = Math.min(Math.max(at + by, 0), ids.length - 1);
			} else {
				const hovered = rows.findIndex((row) => row.matches(":hover"));
				next = hovered >= 0 ? hovered : firstInView(rows);
			}

			// The keys walk the list instead of scrolling the page, and a text
			// selection left from a drag no longer says what is picked.
			event.preventDefault();
			document.getSelection()?.removeAllRanges();

			const id = ids[next];
			const start = anchor.current === null ? -1 : ids.indexOf(anchor.current);
			if (!event.shiftKey || start < 0) anchor.current = id;
			cursor.current = id;

			const from = ids.indexOf(anchor.current ?? id);
			const [low, high] = from < next ? [from, next] : [next, from];
			setPicked(new Set(ids.slice(low, high + 1)));
			rows[next].scrollIntoView({ block: "nearest" });
		}

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") clear();
			if (event.key === "ArrowDown" || event.key === "ArrowUp") walk(event);
		}

		document.addEventListener("selectionchange", onSelectionChange);
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("click", onClick);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("selectionchange", onSelectionChange);
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("click", onClick);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [clear, kind, pickRows]);

	return { picked, clear, pickAll };
}
