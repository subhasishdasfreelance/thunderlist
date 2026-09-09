import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	redirect,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { AppFrame } from "#/components/shell/app-frame";
import { getSessionFn } from "#/functions/session.functions";
import { THEME_INIT_SCRIPT } from "#/lib/theme";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	/*
	 * The gate, and the only one.
	 *
	 * It runs on the server before any route below it loads, so a signed-out
	 * request is redirected before a single loader has asked the database for
	 * anything — there is no window in which someone else's data is fetched and
	 * then hidden. Signing in is the one thing that can be done from outside, so
	 * `/login` is the one path allowed through; anyone already signed in is sent
	 * back out of it, which is what makes the login page unreachable once you
	 * are in.
	 *
	 * This decides what is *shown*. What is *readable* is decided separately, per
	 * request, in `requireUserId` — a guard in the router protects screens, not
	 * data, and the two are kept independent on purpose.
	 */
	beforeLoad: async ({ location }) => {
		const user = await getSessionFn();
		const isLoginPage = location.pathname === "/login";

		if (!user && !isLoginPage) {
			throw redirect({ to: "/login", search: { task: undefined } });
		}

		if (user && isLoginPage) {
			throw redirect({ to: "/today", search: { task: undefined } });
		}

		return { user };
	},
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover",
			},
			{
				title: "Thunderlist",
			},
			{
				name: "description",
				content:
					"Thunderlist is a personal productivity app for today's tasks, checklists and progress trackers.",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			// The bolt, as the tab icon. SVG first for the sharp one, PNG for the
			// browsers and platforms that still want a raster.
			{ rel: "icon", type: "image/svg+xml", href: "/logo.svg" },
			{ rel: "icon", type: "image/png", sizes: "640x640", href: "/logo.png" },
			{ rel: "apple-touch-icon", href: "/logo.png" },
		],
	}),
	component: RootComponent,
	shellComponent: RootDocument,
});

function RootComponent() {
	const { user } = Route.useRouteContext();

	// The frame is rendered signed out too — it drops everything that needs an
	// account and keeps the bar, so the login page is recognisably this app
	// rather than a page from somewhere else.
	return (
		<AppFrame user={user ?? null}>
			<Outlet />
		</AppFrame>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		/*
		 * `suppressHydrationWarning` is on the html element because something is
		 * meant to have changed it before React arrives: the script below writes
		 * `data-theme` ahead of the first paint, which is the whole point of it.
		 * React compares the markup it sent with the DOM it finds, sees an
		 * attribute it did not write, and reports a mismatch it cannot repair.
		 *
		 * It suppresses the warning for this element's own attributes only —
		 * children are still checked — so it silences the one difference that is
		 * deliberate without hiding any that are not.
		 */
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				{/*
				 * Sets the colour scheme before the first paint. Anything later —
				 * an effect, a hydration pass — renders the default scheme first,
				 * which is a white flash for anyone who chose dark.
				 */}
				{/** biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string built at module scope, with no input in it. */}
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
			</head>
			<body>
				{children}
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
