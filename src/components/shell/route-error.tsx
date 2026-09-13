import {
	ErrorComponent,
	type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { LoadingState } from "#/components/common/loading-state";
import { isChunkLoadError, reloadForCurrentVersion } from "#/lib/chunk-reload";

/** How often to try again while a reload has to wait; see `ReloadingScreen`. */
const RETRY_MS = 3_000;

/**
 * What a screen shows when it fails to load.
 *
 * A screen whose code could not be fetched is not an error to show anyone: it
 * is fixed by loading the page afresh, which brings the current version; see
 * `reloadForCurrentVersion`. So the loading screen stays up while that happens.
 * Anything else is the router's own error, as before.
 */
export function RouteError({ error }: ErrorComponentProps) {
	if (!isChunkLoadError(error)) return <ErrorComponent error={error} />;
	return <ReloadingScreen />;
}

/**
 * Reload now if that is allowed, and keep trying until it is.
 *
 * A reload is held back while offline, and just after one has been tried, so a
 * page that keeps failing does not reload in a tight loop. Rather than give up
 * with a message then, it tries again every few seconds: the fix is the same
 * either way, and it arrives by itself once the connection is back.
 */
function ReloadingScreen() {
	useEffect(() => {
		if (reloadForCurrentVersion()) return;

		const retry = window.setInterval(reloadForCurrentVersion, RETRY_MS);
		return () => window.clearInterval(retry);
	}, []);

	return <LoadingState />;
}
