import { TanStackDevtools } from "@tanstack/react-devtools";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
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
import { OfflineBanner } from "#/components/shell/offline-banner";
import { UndoProvider } from "#/components/shell/undo-provider";
import { isChunkLoadError, reloadForCurrentVersion } from "#/lib/chunk-reload";
import { FIRST_OPEN_SCRIPT } from "#/lib/first-open";
import { drawnColorScheme, THEME_INIT_SCRIPT } from "#/lib/theme";
import { useNewVersionCheck } from "#/lib/use-new-version";
import { useIsOnline } from "#/lib/use-online";
import { backdropsQuery } from "#/queries/preferences";
import { primeQuery } from "#/queries/prime";
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
			throw redirect({ to: "/" });
		}

		// The illustrations behind every screen, so the first page is drawn
		// with the one picked rather than the default; see `Scenery`.
		if (user) await primeQuery(context.queryClient, backdropsQuery());

		// The scheme to draw in, so the server's page is already the right one;
		// see `drawnColorScheme`.
		return { user, colorScheme: drawnColorScheme() };
	},
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				// `resizes-content`: on Android the on-screen keyboard shrinks the
				// page rather than covering it, so a dialog's fields and buttons
				// stay above it.
				content:
					"width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content",
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
			// The wordmark's face, 2 KB, asked for with the page so the name
			// never draws in a stand-in first; see `.thunderlist-brand-name`.
			{
				rel: "preload",
				href: "/fonts/space-grotesk-wordmark.woff2",
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous",
			},
			// The bolt, as the tab icon. SVG first for the sharp one, PNG for the
			// browsers and platforms that still want a raster.
			{ rel: "icon", type: "image/svg+xml", href: "/logo.svg" },
			{ rel: "icon", type: "image/png", sizes: "640x640", href: "/logo.png" },
			// Installing to a home screen. iOS fills a transparent icon with black,
			// so its icon has the brand blue behind the bolt.
			// `?v=2` is an address no phone has cached: an earlier build let the file
			// be kept for a week, and a reinstall kept reading that old copy. The
			// file is never cached now, so this should not need changing again.
			{ rel: "manifest", href: "/manifest.webmanifest?v=2" },
			{ rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
		],
	}),
	component: RootComponent,
	shellComponent: RootDocument,
});

function RootComponent() {
	const { user, colorScheme } = Route.useRouteContext();

	/*
	 * The service worker, which keeps the hashed bundle cached so the installed
	 * app starts quickly; see `public/sw.js`. Production only: in development
	 * Vite serves modules straight from source and there is nothing to keep.
	 */
	useEffect(() => {
		if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
		const { serviceWorker } = navigator;
		// Not registering only costs the cache; the app works the same without it.
		// A new worker taking over is a new version, fetched like any other;
		// see `useNewVersionCheck`.
		serviceWorker.register("/sw.js").catch(() => {});
	}, []);

	// A deploy made while the page is open is fetched; the release push
	// notification offers it.
	useNewVersionCheck();

	/*
	 * A page left open across a deploy can ask for a chunk the server no longer
	 * has. Loading afresh picks up the new version instead. Kept apart from the
	 * worker: it happens in development, and wherever a worker cannot be
	 * registered, just the same. While the page reloads the error is held back,
	 * so it never flashes on screen first; should the reload not be allowed yet,
	 * it reaches the screen, which waits and tries again; see `RouteError`.
	 *
	 * A failed import that no screen was waiting on — code fetched ahead of a
	 * click — surfaces as an unhandled rejection instead, and is dealt with the
	 * same way.
	 */
	useEffect(() => {
		const onPreloadError = (event: Event) => {
			if (reloadForCurrentVersion()) event.preventDefault();
		};
		const onUnhandled = (event: PromiseRejectionEvent) => {
			if (isChunkLoadError(event.reason) && reloadForCurrentVersion()) {
				event.preventDefault();
			}
		};
		window.addEventListener("vite:preloadError", onPreloadError);
		window.addEventListener("unhandledrejection", onUnhandled);
		return () => {
			window.removeEventListener("vite:preloadError", onPreloadError);
			window.removeEventListener("unhandledrejection", onUnhandled);
		};
	}, []);

	/*
	 * Leaving while a change is still on its way — waiting out a dropped
	 * connection, say — would lose it, though the screen already showed it as
	 * made. The browser asks first, in its own words.
	 */
	const queryClient = useQueryClient();
	useEffect(() => {
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (queryClient.isMutating() > 0) event.preventDefault();
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [queryClient]);

	const isOnline = useIsOnline();

	// The frame is rendered signed out too — it drops everything that needs an
	// account and keeps the bar, so the login page is recognisably this app
	// rather than a page from somewhere else.
	//
	// Offline the page stays, under a banner saying so: what was being read is
	// still there to read, and anything half typed is not lost. Changes are
	// refused meanwhile; see `useApplyChange`.
	// Ctrl+Z wraps the whole frame rather than the screens inside it, so the
	// last few things done are still there to take back after moving between
	// them; see `UndoProvider`.
	return (
		<UndoProvider>
			<AppFrame user={user ?? null} colorScheme={colorScheme}>
				{isOnline ? null : <OfflineBanner />}
				<Outlet />
			</AppFrame>
		</UndoProvider>
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
				 * The phone's status bar: the app's dark background in both schemes.
				 * The installed app on Android takes a single colour, `theme_color`
				 * in `public/manifest.webmanifest`, so that one is dark. This tag
				 * matches it, so Android picks white text for the bar everywhere
				 * and a browser tab looks the same as the installed app.
				 */}
				<meta name="theme-color" content="#0F1018" />
				{/*
				 * Sets the colour scheme before the first paint. Anything later —
				 * an effect, a hydration pass — renders the default scheme first,
				 * which is a white flash for anyone who chose dark.
				 */}
				{/** biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string built at module scope, with no input in it. */}
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				{/* Back from Today on a fresh open goes to the Checklists; see `FIRST_OPEN_SCRIPT`. */}
				{/** biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string built at module scope, with no input in it. */}
				<script dangerouslySetInnerHTML={{ __html: FIRST_OPEN_SCRIPT }} />
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
