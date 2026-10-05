import { Button } from "@astryxdesign/core/Button";
import { RotateCw } from "lucide-react";
import { useEffect } from "react";
import { useToast } from "#/lib/toasts";
import { BUILD_ID } from "#/lib/version";

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
 * Notice a new deploy while the page is open, and offer to load it.
 *
 * As the app opens — a launch can open on a copy kept from before a deploy —
 * every few minutes after, as the page comes back into view, as the connection
 * returns, as a new service worker takes over, and as a release notification
 * arrives (see `announceRelease`), the server is asked which build it runs. A
 * different one has its files fetched in the background, and only then is the
 * refresh offered, so taking it up is quick. Nothing reloads by itself: a
 * reload in the middle of typing would lose it.
 *
 * Taking it up — here or from the notification — closes the offer at once:
 * the new page can take a moment to arrive, and an offer still up after the
 * tap reads as a tap that did nothing.
 *
 * Production only: in development Vite swaps code in by itself.
 */
export function useNewVersionPrompt(): void {
	const toast = useToast();

	useEffect(() => {
		if (!import.meta.env.PROD) return;

		let lastChecked = 0;
		let isChecking = false;
		/** The build already offered, so it is not offered again. */
		let offered: string | null = null;
		/** Closes the offer on screen; `null` while there is none. */
		let dismissOffer: (() => void) | null = null;
		/** Already reloading onto the new version, so there is nothing to offer. */
		let isRefreshing = false;

		function refreshNow() {
			isRefreshing = true;
			dismissOffer?.();
			dismissOffer = null;
		}

		async function check(isForced = false) {
			if (isChecking || !navigator.onLine) return;
			if (!isForced && Date.now() - lastChecked < NOT_SOONER_THAN_MS) return;
			isChecking = true;
			lastChecked = Date.now();

			try {
				const build = await newerBuild();
				if (build === null || build === offered) return;
				await fetchNewFiles();
				if (isRefreshing) return;
				offered = build;
				dismissOffer = toast({
					body: "A new version of Thunderlist is ready.",
					type: "info",
					isAutoHide: false,
					uniqueID: "new-version",
					endContent: (
						<Button
							label="Refresh"
							icon={<RotateCw aria-hidden />}
							size="sm"
							onClick={() => {
								refreshNow();
								window.location.reload();
							}}
						/>
					),
				});
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

		// Told by the service worker that a release notification came, or that
		// it was tapped and this window is about to be reloaded.
		const onWorkerMessage = (event: MessageEvent) => {
			if (event.data?.type === "release") void check(true);
			if (event.data?.type === "refreshing") refreshNow();
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
	}, [toast]);
}
