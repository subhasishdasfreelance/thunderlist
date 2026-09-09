import { useRouterState } from "@tanstack/react-router";

/**
 * A thread of colour across the top while a page is on its way.
 *
 * Navigation here can wait on a round trip, and a screen that simply does not
 * change for half a second reads as a click that missed. This is the smallest
 * honest answer to "did that work" — it costs no layout, so nothing below it
 * moves when it appears. Saves are answered separately, by `SaveIndicator`.
 *
 * It is deliberately indeterminate. The router knows a load is running, not how
 * far along it is, and a bar that invents a percentage is worse than one that
 * admits it is only saying "working".
 */
export function RouteProgress() {
	const isLoading = useRouterState({
		select: (state) => state.status === "pending",
	});

	if (!isLoading) return null;

	return (
		<div
			className="thunderlist-route-progress"
			role="progressbar"
			aria-label="Loading page"
			aria-busy="true"
		/>
	);
}
