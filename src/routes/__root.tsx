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
import { useEffect } from "react";
import { AppFrame } from "#/components/shell/app-frame";
import { STATUS_BAR_COLORS, THEME_INIT_SCRIPT } from "#/lib/theme";
import { sessionQuery } from "#/queries/session";
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
	 *
	 * That independence is what lets the answer be remembered rather than asked
	 * for on every click, which put a round trip in front of every navigation.
	 * The server's answer travels down with the first page, sign-out clears it
	 * along with every other query, and once it is a minute old it is re-checked
	 * in the background — so a session that ended elsewhere is still caught on
	 * the next click, without that click waiting for it.
	 */
	beforeLoad: async ({ context, location }) => {
		const user = await context.queryClient.ensureQueryData({
			...sessionQuery(),
			revalidateIfStale: true,
		});
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
			// Installing to a home screen. iOS fills a transparent icon with black,
			// so its icon has the brand blue behind the bolt.
			{ rel: "manifest", href: "/manifest.webmanifest" },
			{ rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
		],
	}),
	component: RootComponent,
	shellComponent: RootDocument,
});

function RootComponent() {
	const { user } = Route.useRouteContext();

	/*
	 * The service worker, which keeps the hashed bundle cached so the installed
	 * app starts quickly; see `public/sw.js`. Production only: in development
	 * Vite serves modules straight from source and there is nothing to keep.
	 */
	useEffect(() => {
		if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
		// Not registering only costs the cache; the app works the same without it.
		navigator.serviceWorker.register("/sw.js").catch(() => {});

		// Today can open from a copy saved before the latest deploy, which may
		// then ask for a chunk the server no longer has. Loading afresh fixes it.
		const reload = () => window.location.reload();
		window.addEventListener("vite:preloadError", reload);
		return () => window.removeEventListener("vite:preloadError", reload);
	}, []);

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
				 * The phone's status bar, matched to the page under the top bar in
				 * each scheme. Written here rather than in `head()`, which keeps
				 * only one meta tag per name and would drop the second. The script
				 * below repaints both for a scheme chosen in the app, which is why
				 * a different `content` is expected at hydration.
				 */}
				<meta
					name="theme-color"
					media="(prefers-color-scheme: light)"
					content={STATUS_BAR_COLORS.light}
					suppressHydrationWarning
				/>
				<meta
					name="theme-color"
					media="(prefers-color-scheme: dark)"
					content={STATUS_BAR_COLORS.dark}
					suppressHydrationWarning
				/>
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
