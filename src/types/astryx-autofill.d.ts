/**
 * `autoComplete` on Astryx's text fields.
 *
 * Both of them already hand every prop they do not recognise straight to the
 * `<input>` or `<textarea>` underneath, so the attribute has always worked —
 * it just was not in the types. `BaseProps` builds on React's
 * `HTMLAttributes`, which has no `autoComplete` because the attribute belongs
 * to form controls rather than to elements in general, and neither component
 * names it again. `NumberInput` does, which is why only these two are here.
 *
 * Every field in the app sets it. A dialog of plain fields is not a sign-up
 * form, but on a phone the browser guesses that it is: a number beside a note
 * offered saved cards, and a lone text field offered saved passwords. The one
 * exception is the address a team member is added by, which says `email`,
 * because there the browser knowing the answer is the point.
 */

declare module "@astryxdesign/core/TextInput" {
	interface TextInputProps {
		autoComplete?: string;
	}
}

declare module "@astryxdesign/core/TextArea" {
	interface TextAreaProps {
		autoComplete?: string;
	}
}

export {};
