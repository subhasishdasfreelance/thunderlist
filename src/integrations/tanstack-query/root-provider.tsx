import { focusManager, QueryClient } from "@tanstack/react-query";

/**
 * How often a screen left open re-reads what it is showing.
 *
 * A change made here is drawn at once and everything is read again as it saves,
 * so this is for the changes made somewhere else — another window, a phone, a
 * teammate — which nothing would otherwise mention. Half a minute is close
 * enough that a screen is never far behind, and quiet enough that a screen
 * nobody is touching is not a stream of requests.
 *
 * Only while the screen is being looked at: React Query holds the interval
 * while the page is hidden, so a tab left open in the background asks for
 * nothing until it is opened again.
 */
const REFRESH_MS = 30_000;

/*
 * Coming back to the app is the other moment to catch up.
 *
 * React Query listens for the page being shown again, which catches a phone
 * being unlocked and a tab being returned to, but not the commonest way of
 * coming back at a desk: two windows side by side, where neither is ever
 * hidden and so neither is ever "shown again". The window's own focus is added
 * to it, so moving between them catches up too.
 *
 * In the browser only; on the server there is nothing to come back to.
 */
if (typeof window !== "undefined") {
	focusManager.setEventListener((handleFocus) => {
		const onFocus = () => handleFocus();
		window.addEventListener("visibilitychange", onFocus, false);
		window.addEventListener("focus", onFocus, false);

		return () => {
			window.removeEventListener("visibilitychange", onFocus);
			window.removeEventListener("focus", onFocus);
		};
	});
}

export function getContext() {
	/*
	 * Neither catching-up happens while a change is still saving — the interval
	 * below, nor coming back to the window. A read sent in the middle of a
	 * change comes back without it and would blink out what the screen has
	 * already drawn; the change's own refetch, once it lands, is what every
	 * screen catches up on. See `useApplyChange`.
	 */
	const queryClient: QueryClient = new QueryClient({
		defaultOptions: {
			queries: {
				refetchInterval: () =>
					queryClient.isMutating() > 0 ? false : REFRESH_MS,
				refetchOnWindowFocus: () => queryClient.isMutating() === 0,
			},
		},
	});

	return {
		queryClient,
	};
}
