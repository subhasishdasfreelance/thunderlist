import { useEffect } from "react";
import { readStored, writeStored } from "#/lib/device-data";
import { useToast } from "#/lib/toasts";
import { BUILD_ID, BUILT_AT } from "#/lib/version";

/** When the newest build this browser has run was made; see `useUpdatedNotice`. */
const LAST_BUILT_AT_KEY = "thunderlist-last-built-at";

/** How often an open page asks whether there is a newer build. */
const CHECK_EVERY_MS = 5 * 60 * 1000;

/** Coming back to the page asks again, but not more often than this. */
const NOT_SOONER_THAN_MS = 60 * 1000;

/** The build the server is running, when it is not this one; else `null`. */
async function newerBuild(): Promise<string | null> {
	const response = await fetch("/api/version", { cache: "no-store" });
	if (!response.ok) return null;
	const { buildId } = (await response.json()) as { buildId?: unknown };
	return typeof buildId === "string" && buildId !== BUILD_ID ? buildId : null;
}

/**
 * Fetch the new build's files ahead of the refresh, so it is quick: the files
 * this page loads in the new build, read off a fresh copy of it, as the
 * service worker reads them; see `assetsIn` in `public/sw.js`. Each is kept as
 * it arrives, by the worker or by the browser's own cache — they are named by
 * their content, and never change.
 */
async function fetchNewFiles(): Promise<void> {
	const page = await fetch(window.location.href, {
		headers: { accept: "text/html" },
	});
	const html = await page.text();
	const files = new Set(
		Array.from(html.matchAll(/["'](\/assets\/[^"'?#\s]+)/g), (m) => m[1]),
	);
	await Promise.allSettled([
		...[...files].map((file) => fetch(file)),
		refreshStartPages(),
	]);
}

/**
 * Have the service worker fetch its kept copy of the start page afresh, so
 * refreshing there brings the new version and not the copy kept before it;
 * see `refreshStartPages` in `public/sw.js`. Not waited on for long.
 */
function refreshStartPages(): Promise<void> {
	const worker = navigator.serviceWorker?.controller;
	if (!worker) return Promise.resolve();

	return new Promise((resolve) => {
		const channel = new MessageChannel();
		channel.port1.onmessage = () => resolve();
		worker.postMessage({ type: "refresh-start-pages" }, [channel.port2]);
		window.setTimeout(resolve, 15_000);
	});
}

/**
 * Notice a new deploy while the page is open, and get it ready.
 *
 * As the app opens — a launch can open on a copy kept from before a deploy —
 * every few minutes after, as the page comes back into view, as the connection
 * returns, as a new service worker takes over, and as a release notification
 * arrives, the server is asked which build it runs. Asking is also what has a
 * release announced, by push notification, to everyone; see `announceRelease`.
 * A different build has its files fetched in the background, so the refresh —
 * offered by that notification, never on the page — is quick. Nothing reloads
 * by itself: a reload in the middle of typing would lose it.
 *
 * Production only: in development Vite swaps code in by itself.
 */
export function useNewVersionCheck(): void {
	useEffect(() => {
		if (!import.meta.env.PROD) return;

		let lastChecked = 0;
		let isChecking = false;
		/** The build already fetched, so it is not fetched again. */
		let fetched: string | null = null;

		async function check(isForced = false) {
			if (isChecking || !navigator.onLine) return;
			if (!isForced && Date.now() - lastChecked < NOT_SOONER_THAN_MS) return;
			isChecking = true;
			lastChecked = Date.now();

			try {
				const build = await newerBuild();
				if (build === null || build === fetched) return;
				await fetchNewFiles();
				fetched = build;
			} catch {
				// Asked again at the next turn.
			} finally {
				isChecking = false;
			}
		}

		const onVisible = () => {
			if (document.visibilityState === "visible") void check();
		};
		const onOnline = () => void check();
		// A new worker is a new deploy, so it is asked about at once. Not on a
		// first visit, where there was no worker before this one.
		const { serviceWorker } = navigator;
		const hadWorker = serviceWorker?.controller != null;
		const onNewWorker = () => {
			if (hadWorker) void check(true);
		};

		// Told by the service worker that a release notification came.
		const onWorkerMessage = (event: MessageEvent) => {
			if (event.data?.type === "release") void check(true);
		};

		void check(true);
		const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener("online", onOnline);
		serviceWorker?.addEventListener("controllerchange", onNewWorker);
		serviceWorker?.addEventListener("message", onWorkerMessage);

		return () => {
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", onVisible);
			window.removeEventListener("online", onOnline);
			serviceWorker?.removeEventListener("controllerchange", onNewWorker);
			serviceWorker?.removeEventListener("message", onWorkerMessage);
		};
	}, []);
}

/**
 * Say so when the app opens on a newer version than it last ran — the one
 * `useNewVersionCheck` fetched in the background last time.
 *
 * Compared by when each build was made, not by name: a launch can paint a kept
 * copy of the start page from before a deploy after a newer page has already
 * run, and that older copy is not an update. A first visit only remembers.
 */
export function useUpdatedNotice(): void {
	const toast = useToast();

	useEffect(() => {
		if (!import.meta.env.PROD) return;

		const lastBuiltAt = Number(readStored(LAST_BUILT_AT_KEY) ?? Number.NaN);
		if (Number.isFinite(lastBuiltAt) && BUILT_AT <= lastBuiltAt) return;

		writeStored(LAST_BUILT_AT_KEY, String(BUILT_AT));
		if (!Number.isFinite(lastBuiltAt)) return;

		toast({
			body: "Thunderlist has been updated to the latest version.",
			type: "info",
			uniqueID: "updated",
		});
	}, [toast]);
}
