import { useEffect } from "react";
import { isTyping, PRESSABLE } from "#/lib/use-row-shortcuts";

/**
 * The keys a bar over a pick answers to, lowercase, each to what it does for
 * everything picked; see `SelectionBar` and `PickBar`.
 *
 * Heard ahead of the row under the pointer, which would act on itself too,
 * and never while typing, in a dialog, or with a modifier held. Space and
 * Enter still press the button or box focus is on.
 */
export function usePickKeys(
	keys: Record<string, (() => void) | undefined>,
): void {
	useEffect(() => {
		function handle(event: KeyboardEvent) {
			const run = keys[event.key.toLowerCase()];
			if (run === undefined) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isTyping(event.target)) return;
			if (
				event.target instanceof Element &&
				event.target.closest('dialog, [role="dialog"]')
			) {
				return;
			}
			if (
				(event.key === " " || event.key === "Enter") &&
				event.target instanceof Element &&
				event.target.closest(PRESSABLE) !== null
			) {
				return;
			}

			event.preventDefault();
			event.stopImmediatePropagation();
			run();
		}

		window.addEventListener("keydown", handle, true);
		return () => window.removeEventListener("keydown", handle, true);
	});
}
