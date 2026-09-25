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
			return dismiss;
		},
		[show],
	);
}

/** Close every toast on screen. Whether there was one to close. */
export function dismissAllToasts(): boolean {
	if (showing.size === 0) return false;

	for (const dismiss of [...showing]) dismiss();
	showing.clear();
	return true;
}
