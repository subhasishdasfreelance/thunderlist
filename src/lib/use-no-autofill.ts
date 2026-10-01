/**
 * Plain text fields, everywhere: no offers of saved passwords, addresses or
 * cards.
 *
 * Every field already says `autoComplete="off"`; see
 * `src/types/astryx-autofill.d.ts`. Chrome on Android does not take that as a
 * no, nor a value it does not recognise: the bar of saved passwords, cards and
 * addresses (🔑 💳 📍) still sat above the keyboard on any text field. What it
 * does leave alone is a search field with nothing to suggest — see
 * `NumberField` — and a text area. So every one-line text field is made a
 * search field, and its `type` keeps answering "search" so React cannot write
 * "text" back on the next render. The password extensions people add each
 * listen for an attribute of their own, so those go on every field too.
 *
 * Rather than repeat all of this on every field — and miss the date and time
 * fields that Astryx draws itself — each field is given it the moment it
 * enters the page, well before it is tapped. A field focused as it is drawn
 * could beat that, but those only take focus where there is a real keyboard,
 * and so no bar; the search box, which always does, is a search field from
 * its first render.
 *
 * A field that asks for real autofill by name (`email`, the address a team
 * member is added by) is left as it is: there, the browser knowing the answer
 * is the point.
 */

import { useEffect } from "react";

/** A value no browser recognises, for the browsers that do honour it. */
const NOT_FOR_AUTOFILL = "thunderlist-off";

/** What each of the common managers reads as "not for me". */
const IGNORED_BY_MANAGERS: ReadonlyArray<[string, string]> = [
	["data-1p-ignore", "true"], // 1Password
	["data-lpignore", "true"], // LastPass
	["data-bwignore", "true"], // Bitwarden
	["data-form-type", "other"], // Dashlane
];

function asSearchField(input: HTMLInputElement) {
	input.setAttribute("type", "search");
	// A search field's key says "search"; unless the field says otherwise,
	// this one only finishes typing.
	if (!input.hasAttribute("enterkeyhint")) input.enterKeyHint = "done";
	Object.defineProperty(input, "type", {
		configurable: true,
		get: () => "search",
		set: () => {},
	});
}

function stamp(field: HTMLInputElement | HTMLTextAreaElement) {
	const asked = field.getAttribute("autocomplete");
	if (asked !== null && asked !== "off") return;

	field.setAttribute("autocomplete", NOT_FOR_AUTOFILL);
	for (const [name, value] of IGNORED_BY_MANAGERS) {
		field.setAttribute(name, value);
	}
	if (field instanceof HTMLInputElement && field.type === "text") {
		asSearchField(field);
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
