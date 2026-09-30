/**
 * Every main screen, ready before it is visited.
 *
 * A screen's code and its data are otherwise fetched when it is first asked
 * for — on a hover at a desk, but on a phone only as the finger lands, which
 * leaves the new screen a moment of spinners where its list and its background
 * should be. So once the app has loaded in full and the first screen has
 * settled, every screen the bar and the digit keys go to is preloaded behind
 * it: its code, which the service worker then keeps, and its loader's reads,
 * which the query cache keeps.
 *
 * Kept warm after that as stale-while-revalidate: every few minutes, while the
 * app is on screen and online, the preload runs again. A read still cached is
 * left as it is — visiting its screen draws it at once and re-reads it behind
 * (`refetchOnMount`) — and one the cache has let go of is read afresh.
 */

import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { PAGE_SHORTCUTS } from "#/components/shell/nav-items";

/** How long after loading the first screen is left to itself. */
const SETTLE_MS = 3_000;

/**
 * How often the screens are warmed again. The query cache lets go of a read no
 * screen is showing after five minutes, so this is when there is anything to
 * fetch again.
 */
const REWARM_MS = 5 * 60_000;

export function useWarmPages(isSignedIn: boolean): void {
	const router = useRouter();

	useEffect(() => {
		if (!isSignedIn) return;

		function warm() {
			if (document.visibilityState !== "visible" || !navigator.onLine) return;

			for (const page of PAGE_SHORTCUTS) {
				void router
					.preloadRoute({
						to: page.to,
						params: page.params,
						search: { task: undefined },
					} as never)
					.catch(() => undefined);
			}
		}

		const first = window.setTimeout(warm, SETTLE_MS);
		const again = window.setInterval(warm, REWARM_MS);
		return () => {
			window.clearTimeout(first);
			window.clearInterval(again);
		};
	}, [isSignedIn, router]);
}
