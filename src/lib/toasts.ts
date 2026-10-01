/**
 * Astryx's toasts, with a way to close every one on screen at once.
 *
 * Astryx hands back a dismiss function for each toast it shows and keeps its
 * own list private, so this keeps the dismiss functions of the ones still up.
 * Escape uses it, as the last thing a press closes; see `useEscape`.
 */

import {
	type ShowToastFn,
	useToast as useAstryxToast,
} from "@astryxdesign/core/Toast";
import { useCallback } from "react";

const showing = new Set<() => void>();

/** `useToast`, remembering how to take each toast down again. */
export function useToast(): ShowToastFn {
	const show = useAstryxToast();

	return useCallback<ShowToastFn>(
		(options) => {
			const dismiss = show({
				...options,
				onHide: (reason) => {
					showing.delete(dismiss);
					options.onHide?.(reason);
				},
			});
			showing.add(dismiss);
			// Once the toast is drawn, so there is a viewport to find.
			requestAnimationFrame(raiseAboveDialogs);
			return dismiss;
		},
		[show],
	);
}

/**
 * Bring the toasts back above every dialog.
 *
 * Astryx puts its toast viewport in the browser's top layer once, as the app
 * starts, and the top layer stacks by arrival: a dialog opened since then —
 * the whole screen, on a phone — sits over it, toasts and all. Showing the
 * viewport again makes it the newest arrival, so the toast is seen.
 */
function raiseAboveDialogs() {
	const viewport = document
		.querySelector("[data-toast-id]")
		?.closest<HTMLElement>("[popover]");
	if (!viewport?.matches(":popover-open")) return;

	viewport.hidePopover();
	viewport.showPopover();
}

/** Close every toast on screen. Whether there was one to close. */
export function dismissAllToasts(): boolean {
	if (showing.size === 0) return false;

	for (const dismiss of [...showing]) dismiss();
	showing.clear();
	return true;
}
