import type { ReactNode } from "react";

/**
 * Two fields that belong together, side by side where there is room.
 *
 * A horizontal stack keeps them on one line at any width, which on a phone
 * makes the dialog wider than the screen and the whole form something you drag
 * sideways to read. A grid stacks them instead, and gives them equal widths on
 * a desktop rather than letting the longer label win.
 */
export function FieldRow({ children }: { children: ReactNode }) {
	return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}
