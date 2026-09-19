import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { RouteError } from "./components/shell/route-error";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const context = getContext();

	const router = createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		/*
		 * Every navigation is a view transition.
		 *
		 * The browser holds the old screen, swaps the content, and cross-fades
		 * the two — so a page arrives instead of blinking into place, and the
		 * bars around it stay exactly where they are while it does; see
		 * "View transitions" in `styles.css`. Where the browser has no such
		 * thing the router falls back to a plain navigation, and the arrival
		 * animation keyed on the path takes over instead.
		 */
		defaultViewTransition: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultErrorComponent: RouteError,
	});

	setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
