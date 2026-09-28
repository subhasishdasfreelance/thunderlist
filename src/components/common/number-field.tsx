import { NumberInput } from "@astryxdesign/core/NumberInput";
import type { ComponentProps } from "react";

/**
 * Astryx's `NumberInput`, without Chrome's bar of saved passwords, cards and
 * addresses (🔑 💳 📍) above the keyboard on Android.
 *
 * Chrome shows that bar on any text field, whatever `autocomplete` says, but
 * not on a search field that has nothing of its own to suggest — and with
 * `autocomplete="off"` there is nothing. `NumberInput` always renders
 * `type="text"`, and React writes that back on every render, so the input is
 * made a search field for good here: its `type` answers "search" and ignores
 * being set. The keypad is still the number one, from `inputMode`.
 */
export function NumberField(props: ComponentProps<typeof NumberInput>) {
	return <NumberInput {...props} autoComplete="off" ref={asSearchField} />;
}

function asSearchField(input: HTMLInputElement | null) {
	if (input === null) return;
	input.setAttribute("type", "search");
	input.setAttribute("data-number-field", "");
	// A search field's key says "search"; this one only finishes typing.
	input.enterKeyHint = "done";
	Object.defineProperty(input, "type", {
		configurable: true,
		get: () => "search",
		set: () => {},
	});
}
