import { useRef } from "react";

/**
 * The last value that was not `null`.
 *
 * A confirmation names what it is about — a task's title, how many — and
 * the thing it names can go the moment it is confirmed: the change is drawn
 * at once, while the dialog is still fading out. Reading from this keeps the
 * words on it as they were asked, until it has gone.
 */
export function useHeld<T>(value: T | null): T | null {
	const held = useRef(value);
	if (value !== null) held.current = value;
	return held.current;
}
