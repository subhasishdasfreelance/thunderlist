import { startTransition, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

/** The value as of the latest render, for a handler that outlives its own. */
export function useLatest<T>(value: T): { readonly current: T } {
	const ref = useRef(value);
	useLayoutEffect(() => {
		ref.current = value;
	});
	return ref;
}

/**
 * What is being typed into a field: drawn at once, while the screen around
 * the field hears of it a moment later.
 *
 * A field whose value lives in the form around it draws the whole form again
 * on every keystroke — the dialog, its date picker, everything beside it —
 * before the letter shows. Here the field keeps `draft` itself, so a
 * keystroke draws only the field, and passes it on in a transition the next
 * keystroke may cut short; see `startTransition`.
 *
 * Until that lands, the form holds the value from a keystroke or two ago, so
 * anything about to read it calls `flush` first: Enter, which saves or adds,
 * and leaving the field, which a press on Save always does first.
 *
 * A `value` the field did not send — a dialog opened afresh, a field cleared
 * once its task was added — is taken as it is.
 */
export function useTypedValue<E>(
	value: string,
	onChange: ((value: string, event: E) => void) | undefined,
): {
	draft: string;
	type: (next: string, event: E) => void;
	flush: () => void;
} {
	const [draft, setDraft] = useState(value);
	// Passed on and not yet back as `value`, oldest first.
	const unheard = useRef<Array<string>>([]);
	const last = useRef<{ value: string; event: E } | null>(null);
	const report = useLatest(onChange);

	useLayoutEffect(() => {
		const at = unheard.current.indexOf(value);
		if (at === -1) {
			unheard.current = [];
			setDraft(value);
		} else {
			// What came back, and anything sent before it, has been heard.
			unheard.current = unheard.current.slice(at + 1);
		}
	}, [value]);

	function type(next: string, event: E) {
		setDraft(next);
		unheard.current.push(next);
		last.current = { value: next, event };
		startTransition(() => report.current?.(next, event));
	}

	function flush() {
		const latest = last.current;
		if (unheard.current.length === 0 || latest === null) return;
		flushSync(() => report.current?.(latest.value, latest.event));
	}

	return { draft, type, flush };
}
