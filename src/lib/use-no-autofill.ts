/**
 * Plain text fields, everywhere: no offers of saved passwords, addresses or
 * cards.
 *
 * Every field already says `autoComplete="off"`; see
 * `src/types/astryx-autofill.d.ts`. Chrome's own password manager does not
 * take that as a no, and neither do the password extensions people add to
 * it, each of which listens for an attribute of its own. Rather than repeat
 * all of them on every field — and miss the date, time and number fields that
 * Astryx draws itself — each field is given them the moment it takes focus,
 * before anything can offer to fill it.
 *
 * A field that asks for real autofill by name (`email`, the address a team
 * member is added by) is left as it is: there, the browser knowing the answer
 * is the point.
 */

import { useEffect } from "react";

/** What each of the common managers reads as "not for me". */
const IGNORED_BY_MANAGERS: ReadonlyArray<[string, string]> = [
	["data-1p-ignore", "true"], // 1Password
	["data-lpignore", "true"], // LastPass
	["data-bwignore", "true"], // Bitwarden
	["data-form-type", "other"], // Dashlane
];

export function useNoAutofill(): void {
	useEffect(() => {
		function onFocus(event: FocusEvent) {
			const field = event.target;
			if (
				!(field instanceof HTMLInputElement) &&
				!(field instanceof HTMLTextAreaElement)
			) {
				return;
			}

			const asked = field.getAttribute("autocomplete");
			if (asked !== null && asked !== "off") return;

			field.setAttribute("autocomplete", "off");
			for (const [name, value] of IGNORED_BY_MANAGERS) {
				field.setAttribute(name, value);
			}
		}

		// Capture: focus does not bubble, and this has to land before any
		// manager's own focus handler decides to offer something.
		document.addEventListener("focus", onFocus, true);
		return () => document.removeEventListener("focus", onFocus, true);
	}, []);
}
