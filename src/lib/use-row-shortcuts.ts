/**
 * Keyboard shortcuts for the row the pointer is over.
 *
 * Going through a list is a two-handed job: the pointer picks the row, the
 * keyboard does the thing. That is faster than moving to a button for every
 * task, and it needs no selection model — what is under the cursor is what the
 * key applies to.
 *
 * Nothing fires while text is being typed, or with a modifier held, so the
 * shortcuts never take a key away from the field the user is in.
 */

import { useEffect } from "react";

/** The keys a row answers to, lowercase, mapped to what they do. */
export type RowShortcuts = Record<string, () => void>;

function isTyping(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;

	return (
		target.isContentEditable ||
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	);
}

export function useRowShortcuts(
	isActive: boolean,
	shortcuts: RowShortcuts,
): void {
	useEffect(() => {
		if (!isActive) return;

		function handle(event: KeyboardEvent) {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isTyping(event.target)) return;

			const run = shortcuts[event.key.toLowerCase()];
			if (!run) return;

			// Only once the key is known to be one of ours, so nothing else on the
			// page loses a keystroke to a shortcut that was never going to fire.
			event.preventDefault();

			/*
			 * The key is about the row under the pointer, not wherever focus was
			 * left — a stage tab clicked a moment ago, say. Left there, a keypress
			 * is what makes the browser draw its focus ring, so the tab would
			 * light up as if the key had sent you to it.
			 */
			if (document.activeElement instanceof HTMLElement) {
				document.activeElement.blur();
			}
			run();
		}

		window.addEventListener("keydown", handle);
		return () => window.removeEventListener("keydown", handle);
	}, [isActive, shortcuts]);
}
