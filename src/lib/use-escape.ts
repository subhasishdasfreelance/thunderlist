/**
 * Escape, one layer at a time.
 *
 * Each press closes the nearest thing and no more:
 *
 * 1. A text field being typed in lets go of the caret — quick-add, a field
 *    in a dialog, anywhere. What was typed stays; only the focus goes.
 * 2. Otherwise a popup closes — a dialog, a menu. Astryx does that itself,
 *    from one listener on the document; see its `layerStack`.
 * 3. Otherwise every toast on screen is closed.
 *
 * So a dialog with its caret in a field takes three presses to clear: the
 * field, then the dialog, then any toast behind it.
 *
 * The field is let go of in the capture phase, before anything else hears the
 * press, and the press is marked as used — which Astryx honours by leaving
 * the dialog open. The toasts go in the bubble phase on `window`, after the
 * document's listener has had its chance: a press it used is marked, and is
 * left alone here.
 */

import { useEffect } from "react";
import { dismissAllToasts } from "#/lib/toasts";

/** Input types that take typing; a checkbox or a button is not "typing". */
const TYPED_INPUTS = new Set([
	"text",
	"search",
	"email",
	"url",
	"tel",
	"password",
	"number",
	"date",
	"time",
	"datetime-local",
]);

function isTextField(element: Element | null): element is HTMLElement {
	if (!(element instanceof HTMLElement)) return false;
	if (element.isContentEditable || element instanceof HTMLTextAreaElement) {
		return true;
	}
	return element instanceof HTMLInputElement && TYPED_INPUTS.has(element.type);
}

export function useEscape(): void {
	useEffect(() => {
		function letGoOfField(event: KeyboardEvent) {
			if (event.key !== "Escape" || event.isComposing) return;

			const active = document.activeElement;
			if (!isTextField(active)) return;

			// Focus goes to the popup the field is in, where there is one, rather
			// than to the page: a modal's own Escape only hears presses made
			// from inside it, and the next press is for closing it.
			const layer = active.closest<HTMLElement>(
				'dialog, [role="dialog"], [role="alertdialog"]',
			);
			active.blur();
			if (layer !== null) {
				if (!layer.hasAttribute("tabindex")) layer.tabIndex = -1;
				layer.focus({ preventScroll: true });
			}
			event.preventDefault();
			event.stopPropagation();
		}

		function closeToasts(event: KeyboardEvent) {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			if (dismissAllToasts()) event.preventDefault();
		}

		window.addEventListener("keydown", letGoOfField, true);
		window.addEventListener("keydown", closeToasts);
		return () => {
			window.removeEventListener("keydown", letGoOfField, true);
			window.removeEventListener("keydown", closeToasts);
		};
	}, []);
}
