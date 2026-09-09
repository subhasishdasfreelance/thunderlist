import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { AppFrame } from "#/components/shell/app-frame";
import { THEME_INIT_SCRIPT } from "#/lib/theme";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
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
	return (
		<AppFrame>
			<Outlet />
		</AppFrame>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
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
