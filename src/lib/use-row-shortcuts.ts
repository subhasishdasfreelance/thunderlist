/**
 * Keyboard shortcuts for the row being worked on.
 *
 * Going through a list is a two-handed job: the pointer picks the row, the
 * keyboard does the thing. That is faster than moving to a button for every
 * task. Without a pointer the keyboard picks the row too — with ↑ and ↓ (see
 * `useTaskSelection`) or by tabbing into it — and the same keys work there;
 * see `whoseKeys`.
 *
 * Nothing fires while text is being typed, or with a modifier held, so the
 * shortcuts never take a key away from the field the user is in.
 */

import { type RefObject, useEffect } from "react";
import { isPointerLetGo } from "#/lib/use-escape";

/** The keys a row answers to, lowercase, mapped to what they do. */
export type RowShortcuts = Record<string, () => void>;

/** A task's row, as the lists mark it; see `useTaskSelection`. */
const TASK_ROW = "[data-task-id]";

/** What Space and Enter press, where focus is on one. */
const PRESSABLE =
	'button, a[href], input, [role="button"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="tab"]';

/*
 * Whether focus was put where it is from the keyboard.
 *
 * `:focus-visible` cannot say: a key pressed while a clicked button still has
 * focus makes the browser count that focus as the keyboard's too, at the very
 * keypress being asked about. So how each focus arrived is noted as it
 * arrives — after a key, or after a press of the pointer. Watched once, for
 * every row.
 */
let lastInput: "keyboard" | "pointer" = "pointer";
let keyboardFocus: EventTarget | null = null;
let isWatching = false;

function watchFocus() {
	if (isWatching) return;
	isWatching = true;
	document.addEventListener(
		"keydown",
		() => {
			lastInput = "keyboard";
		},
		true,
	);
	document.addEventListener(
		"pointerdown",
		() => {
			lastInput = "pointer";
		},
		true,
	);
	document.addEventListener(
		"focusin",
		(event) => {
			keyboardFocus = lastInput === "keyboard" ? event.target : null;
		},
		true,
	);
}

/**
 * Whether this row is the one the keys are for, and why — `null` when it is
 * not. The keyboard's choice comes before the pointer's:
 *
 * 1. `focus`: focus is inside the row, put there from the keyboard. Focus left
 *    on a button by a click is not a choice of row — pointing at another row
 *    and pressing a key means that row; see `watchFocus`.
 * 2. `pick`: the one task picked with ↑ and ↓. With several picked, the keys
 *    are the selection bar's; see `SelectionBar`.
 * 3. `pointer`: the row under the pointer, unless Escape let go of it.
 */
function whoseKeys(row: HTMLElement): "focus" | "pick" | "pointer" | null {
	const own = row.closest(TASK_ROW) ?? row;

	const active = document.activeElement;
	const focused =
		active instanceof HTMLElement && active === keyboardFocus
			? active.closest(TASK_ROW)
			: null;
	if (focused !== null) return focused === own ? "focus" : null;

	const picked = document.querySelectorAll(`${TASK_ROW}[data-picked="true"]`);
	if (picked.length > 0) {
		return picked.length === 1 && picked[0] === own ? "pick" : null;
	}

	if (isPointerLetGo()) return null;
	return row.matches(":hover") ? "pointer" : null;
}

/** Inputs that take a press, not typing: a task's tick is the common one. */
const PRESSED_INPUTS = new Set([
	"checkbox",
	"radio",
	"button",
	"submit",
	"reset",
]);

export function isTyping(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;

	return (
		target.isContentEditable ||
		(target instanceof HTMLInputElement && !PRESSED_INPUTS.has(target.type)) ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	);
}

export function useRowShortcuts(
	isActive: boolean,
	shortcuts: RowShortcuts,
	/**
	 * The row, when the keys are only for it while it is the one being worked
	 * on; see `whoseKeys`.
	 *
	 * Asked at the moment of the keypress rather than tracked with enter and
	 * leave events: a row drawn afresh under a pointer that has not moved — a
	 * task just ticked into the finished ones, or a dialog just closed over it —
	 * never hears the pointer enter, and its keys stayed dead until it moved.
	 */
	row?: RefObject<HTMLElement | null>,
): void {
	useEffect(() => {
		if (!isActive) return;
		watchFocus();

		function handle(event: KeyboardEvent) {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isTyping(event.target)) return;
			// Space and Enter press the button or box focus is on, as ever.
			if (
				(event.key === " " || event.key === "Enter") &&
				event.target instanceof Element &&
				event.target.closest(PRESSABLE) !== null
			) {
				return;
			}

			let why: ReturnType<typeof whoseKeys>;
			if (row === undefined) {
				// Escape let go of the row; see `useEscape`.
				why = isPointerLetGo() ? null : "pointer";
			} else {
				why = row.current === null ? null : whoseKeys(row.current);
			}
			if (why === null) return;

			const run = shortcuts[event.key.toLowerCase()];
			if (!run) return;

			// Only once the key is known to be one of ours, so nothing else on the
			// page loses a keystroke to a shortcut that was never going to fire.
			event.preventDefault();

			/*
			 * A key about the row under the pointer is not about wherever focus
			 * was left — a stage tab clicked a moment ago, say. Left there, a
			 * keypress is what makes the browser draw its focus ring, so the tab
			 * would light up as if the key had sent you to it. From the keyboard,
			 * focus is where the person is, and stays.
			 */
			if (why === "pointer" && document.activeElement instanceof HTMLElement) {
				document.activeElement.blur();
			}
			run();
		}

		window.addEventListener("keydown", handle);
		return () => window.removeEventListener("keydown", handle);
	}, [isActive, shortcuts, row]);
}
