/**
 * Plain text fields, everywhere: no offers of saved passwords, addresses or
 * cards.
 *
 * Every field already says `autoComplete="off"`; see
 * `src/types/astryx-autofill.d.ts`. Chrome does not take "off" as a no — on
 * Android least of all, where the installed app still offered addresses,
 * cards and passwords above the keyboard. What Chrome does honour is a value
 * it does not recognise: such a field is left out of its suggestions. The
 * password extensions people add each listen for an attribute of their own.
 * Rather than repeat all of them on every field — and miss the date, time and
 * number fields that Astryx draws itself — each field is given them the
 * moment it enters the page, before the browser has looked at it.
 *
 * A field that asks for real autofill by name (`email`, the address a team
 * member is added by) is left as it is: there, the browser knowing the answer
 * is the point.
 */

import { useEffect } from "react";

/** A value no browser recognises, which is what makes Chrome stand down. */
const NOT_FOR_AUTOFILL = "thunderlist-off";

/** What each of the common managers reads as "not for me". */
const IGNORED_BY_MANAGERS: ReadonlyArray<[string, string]> = [
	["data-1p-ignore", "true"], // 1Password
	["data-lpignore", "true"], // LastPass
	["data-bwignore", "true"], // Bitwarden
	["data-form-type", "other"], // Dashlane
];

function stamp(field: HTMLInputElement | HTMLTextAreaElement) {
	const asked = field.getAttribute("autocomplete");
	if (asked !== null && asked !== "off") return;

	field.setAttribute("autocomplete", NOT_FOR_AUTOFILL);
	for (const [name, value] of IGNORED_BY_MANAGERS) {
		field.setAttribute(name, value);
	}
}

function stampWithin(node: Node) {
	if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
		stamp(node);
		return;
	}
	if (!(node instanceof Element)) return;
	for (const field of node.querySelectorAll("input, textarea")) {
		stamp(field as HTMLInputElement | HTMLTextAreaElement);
	}
}

export function useNoAutofill(): void {
	useEffect(() => {
		stampWithin(document.body);

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) stampWithin(node);
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, []);
}
