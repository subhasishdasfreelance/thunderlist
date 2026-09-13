import { useEffect } from "react";

/** Marks a task's title text; set by `TaggedTitle`. */
const TITLE = "[data-task-title]";

/** Between two copied titles: one blank line. */
const SEPARATOR = "\n\n";

/** The part of a title that falls inside the selection. */
function selectedPart(title: Element, range: Range): string {
	const part = document.createRange();
	part.selectNodeContents(title);

	// The selection may start or end part-way through a title.
	if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) {
		part.setStart(range.startContainer, range.startOffset);
	}
	if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) {
		part.setEnd(range.endContainer, range.endOffset);
	}

	return part.toString().trim();
}

/**
 * Copying tasks copies their titles, and only their titles.
 *
 * A row is more than its title — a checkbox, flag buttons, a divider, a menu —
 * and the browser turns each of those boxes into a line break of its own, so a
 * few copied tasks pasted as titles scattered down a page of blank lines. When a
 * selection runs across two or more titles, the clipboard gets the selected
 * text of each, one blank line apart. A selection inside a single title is left
 * to the browser.
 */
export function useTaskCopy(): void {
	useEffect(() => {
		function handle(event: ClipboardEvent) {
			const selection = document.getSelection();
			if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
				return;
			}

			const range = selection.getRangeAt(0);
			const titles = [...document.querySelectorAll(TITLE)].filter((title) =>
				range.intersectsNode(title),
			);
			if (titles.length < 2) return;

			const text = titles
				.map((title) => selectedPart(title, range))
				.filter((part) => part !== "")
				.join(SEPARATOR);

			event.clipboardData?.setData("text/plain", text);
			event.preventDefault();
		}

		document.addEventListener("copy", handle);
		return () => document.removeEventListener("copy", handle);
	}, []);
}
