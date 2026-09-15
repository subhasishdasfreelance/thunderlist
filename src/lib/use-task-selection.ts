import { useCallback, useEffect, useState } from "react";

/** A task's row carries its id; see the lists on a checklist's and a tag's page. */
const ROW = "[data-task-id]";

/** No task picked. One set, so clearing twice draws nothing again. */
const NONE: ReadonlySet<string> = new Set();

/**
 * The tasks a text selection runs across.
 *
 * Dragging over a few rows to copy what they say is already how several tasks
 * get picked out of a list, so the rows a selection touches — even one word of
 * one — are taken as picked: drawn with a wash, and moved on together from the
 * bar that comes up; see `SelectionBar`. On a phone, the same comes from
 * pressing and holding on a title.
 *
 * The pick outlives the text selection it came from: pressing a button in the
 * bar can clear the selection, and the rows must still be picked when the
 * press lands. It ends with a press on a row, a selection made somewhere else,
 * Escape, or `clear`.
 */
export function useTaskSelection(): {
	picked: ReadonlySet<string>;
	clear: () => void;
} {
	const [picked, setPicked] = useState(NONE);
	const clear = useCallback(() => setPicked(NONE), []);

	useEffect(() => {
		function onSelectionChange() {
			const selection = document.getSelection();
			if (selection === null || selection.isCollapsed) return;
			if (selection.rangeCount === 0) return;

			const range = selection.getRangeAt(0);
			const ids = [...document.querySelectorAll<HTMLElement>(ROW)]
				.filter((row) => range.intersectsNode(row))
				.flatMap((row) => row.dataset.taskId ?? []);

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
				setPicked(NONE);
			}
		}

		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") setPicked(NONE);
		}

		document.addEventListener("selectionchange", onSelectionChange);
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("selectionchange", onSelectionChange);
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	return { picked, clear };
}
