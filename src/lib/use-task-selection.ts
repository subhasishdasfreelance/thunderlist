import { useCallback, useEffect, useRef, useState } from "react";
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
 * pressing and holding on a title.
 *
 * From the keyboard, Down and Up pick the next or previous row — starting at
 * the row under the pointer, or the first on screen — and with Shift held they
 * stretch the pick from where it started. Then a key in the bar moves them
 * all on; see `SelectionBar`.
 *
 * The pick outlives the text selection it came from: pressing a button in the
 * bar can clear the selection, and the rows must still be picked when the
 * press lands. It ends with a press on a row, a selection made somewhere else,
 * Escape, or `clear`.
 */
export function useTaskSelection(kind: PickedRow = "task"): {
	picked: ReadonlySet<string>;
	clear: () => void;
} {
	const [picked, setPicked] = useState(NONE);
	// Where a keyboard pick started, and the row it has reached.
	const anchor = useRef<string | null>(null);
	const cursor = useRef<string | null>(null);

	const clear = useCallback(() => {
		anchor.current = null;
		cursor.current = null;
		setPicked(NONE);
	}, []);

	useEffect(() => {
		const ROW = `[data-${kind}-id]`;
		const idOf = (row: HTMLElement) => row.dataset[`${kind}Id`];

		function onSelectionChange() {
			const selection = document.getSelection();
			if (selection === null || selection.isCollapsed) return;
			if (selection.rangeCount === 0) return;

			const range = selection.getRangeAt(0);
			const ids = [...document.querySelectorAll<HTMLElement>(ROW)]
				.filter((row) => range.intersectsNode(row))
				.flatMap((row) => idOf(row) ?? []);

			// The arrow keys carry on from a pick made with the pointer.
			anchor.current = ids[0] ?? null;
			cursor.current = ids.at(-1) ?? null;
			setPicked((current) =>
				ids.length === 0
					? NONE
					: current.size === ids.length && ids.every((id) => current.has(id))
						? current
						: new Set(ids),
			);
		}

		// A press on a row starts a new selection, or none at all.
		function onPointerDown(event: PointerEvent) {
			if (event.target instanceof Element && event.target.closest(ROW)) {
				clear();
			}
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
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("selectionchange", onSelectionChange);
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [clear, kind]);

	return { picked, clear };
}
