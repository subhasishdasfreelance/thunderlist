/**
 * Opening the app lands on Today, and Back from there goes to the Checklists.
 *
 * On a fresh open — the installed app launched, or a new tab — Today is the
 * only page in the history, so Back left the app. This puts the Checklists
 * underneath it: the entry is rewritten to `/checklists`, and Today pushed
 * back on top.
 *
 * It runs as an inline script in the page's head, before the router has
 * started. The router then finds the history already arranged and knows
 * nothing about the rearranging, so nothing is loaded twice.
 *
 * Only on a fresh open: `history.length` is 1 there and nothing has written a
 * state yet. A reload keeps the router's state, and arriving from another
 * site leaves more than one entry, so neither is touched. When it does
 * rearrange, it says so on `window`, for `useFirstOpenBack`.
 */

import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

declare global {
	interface Window {
		/** Set by `FIRST_OPEN_SCRIPT` when it put the Checklists under Today. */
		thunderlistFirstOpen?: boolean;
	}

	/** Chrome's close requests: Esc, and on Android the back button. */
	class CloseWatcher {
		constructor();
		onclose: (() => void) | null;
		destroy(): void;
	}
}

export const FIRST_OPEN_SCRIPT = `(function(){try{var h=window.history,l=window.location;if(l.pathname!=="/tags/today"||h.length!==1||h.state)return;var here=l.pathname+l.search+l.hash;h.replaceState(null,"","/checklists");h.pushState(null,"",here);window.thunderlistFirstOpen=true;}catch(e){}})();`;

/**
 * Back from Today on Android, the first time.
 *
 * Chrome on Android skips, on Back, a history entry that a page added before
 * anyone had touched it — its guard against pages that trap you with fake
 * entries. The Checklists put under Today is exactly that, so Back went
 * straight past it and closed the app, until something on the page had been
 * tapped. On the desktop it worked.
 *
 * Android's Back is also a close request, which is asked of the page before
 * the history is touched. So while Today is the page the app opened on, a
 * watcher takes that first Back and steps back itself — which, from a
 * script, goes to the Checklists, skipped or not. Only on Android: on the
 * desktop the same request is the Escape key, which already means "close
 * whatever is open" here, and Back works there anyway.
 */
export function useFirstOpenBack(): void {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	useEffect(() => {
		if (
			!window.thunderlistFirstOpen ||
			!/Android/i.test(navigator.userAgent) ||
			typeof CloseWatcher === "undefined"
		) {
			return;
		}

		// Once off Today, the Back this was for is no longer the next one.
		if (pathname !== "/tags/today") {
			window.thunderlistFirstOpen = false;
			return;
		}

		const watcher = new CloseWatcher();
		watcher.onclose = () => {
			window.thunderlistFirstOpen = false;
			window.history.back();
		};
		return () => watcher.destroy();
	}, [pathname]);
}
