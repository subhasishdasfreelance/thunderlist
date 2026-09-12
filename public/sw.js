/*
 * Thunderlist's service worker. Registered from `src/routes/__root.tsx`, in
 * production builds only.
 *
 * 1. The bundle. Everything under `/assets/` is named after a hash of its
 *    content, so a file of a given name never changes. Those are answered from
 *    the cache without touching the network.
 *
 * 2. Pages. From the network, so every page gets the latest version of the app
 *    and of its data. Navigation preload starts the request while this worker
 *    is still waking up, rather than making the page wait for it.
 *
 * 3. The start page. The latest copy of Today — the page the installed app
 *    opens on — is kept, with everything it loads. A launch paints that copy
 *    at once, like a native app opening on what it last showed, while a fresh
 *    one is fetched behind it for next time. It is also what the app opens on
 *    without a connection.
 *
 * Nothing else is touched. Server functions, sign-in and anything from another
 * origin go to the network exactly as if this file did not exist.
 */

const ASSETS = "thunderlist-assets-v1";

/** Also cleared on sign-out, by name, in `src/components/shell/user-menu.tsx`. */
const PAGES = "thunderlist-pages-v1";

/** Pages kept for launching from: the one the installed app opens on. */
const OFFLINE_PAGES = new Set(["/tags/today"]);

/*
 * Every deploy brings a new set of hashed files and leaves the old ones behind,
 * so the cache is capped and trimmed oldest first. Anything trimmed that is
 * still in use is simply fetched and cached again.
 */
const MAX_ENTRIES = 200;

self.addEventListener("install", () => {
	// Nothing is precached, so there is nothing for a new version to wait for.
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			if (self.registration.navigationPreload) {
				await self.registration.navigationPreload.enable();
			}

			const names = await caches.keys();
			await Promise.all(
				names
					.filter((name) => name !== ASSETS && name !== PAGES)
					.map((name) => caches.delete(name)),
			);

			await self.clients.claim();
		})(),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;

	const url = new URL(request.url);

	if (request.mode === "navigate") {
		event.respondWith(
			OFFLINE_PAGES.has(url.pathname) && url.search === ""
				? fromCacheRefreshing(event)
				: fromNetwork(event),
		);
		return;
	}

	if (
		url.origin === self.location.origin &&
		url.pathname.startsWith("/assets/")
	) {
		event.respondWith(fromCache(event));
	}
});

/** A page: the preloaded response if there is one, the network if not. */
async function fromNetwork(event) {
	const preloaded = await event.preloadResponse;
	return preloaded ?? fetch(event.request);
}

/**
 * The start page: the kept copy at once, refreshed from the network behind it.
 *
 * Waiting on the network put a blank window in front of every launch, since
 * the server reads the day's tasks before it answers. The kept copy paints
 * straight away instead, and its data is only a starting point: every read on
 * the page is already stale when it is drawn, so each is asked for again as the
 * page wakes, and the screen catches up within a round trip.
 *
 * With no usable copy — a first launch, just after signing out, or a copy
 * whose files have gone — it is the network, as for any other page.
 */
async function fromCacheRefreshing(event) {
	const saved = await savedPage(event.request.url);
	if (!saved) return fromNetworkKeepingCopy(event);

	event.waitUntil(
		fromNetwork(event)
			.then((response) => savePage(event.request.url, response))
			.catch(() => {}),
	);
	return saved;
}

/**
 * The kept copy of a page, while everything it loads is kept too. The files are
 * trimmed oldest first, and a copy whose bundle has been trimmed away opens onto
 * nothing once a deploy has taken those files off the server.
 */
async function savedPage(url) {
	const saved = await (await caches.open(PAGES)).match(url);
	if (!saved) return null;

	const assets = await caches.open(ASSETS);
	for (const file of assetsIn(await saved.clone().text())) {
		if (!(await assets.match(file))) return null;
	}
	return saved;
}

/** The hashed files a page loads, by path. */
function assetsIn(html) {
	return new Set(
		Array.from(html.matchAll(/["'](\/assets\/[^"'?#\s]+)/g), (m) => m[1]),
	);
}

/** A page from the network, keeping a copy for when there is no network. */
async function fromNetworkKeepingCopy(event) {
	try {
		const response = await fromNetwork(event);
		event.waitUntil(savePage(event.request.url, response.clone()));
		return response;
	} catch (error) {
		const saved = await (await caches.open(PAGES)).match(event.request.url);
		if (saved) return saved;
		throw error;
	}
}

/**
 * Keep a copy of a page, but only once everything it loads is kept too. A copy
 * whose bundle has since left the server — one deploy on — would open onto
 * nothing, so the previous copy stays instead.
 */
async function savePage(url, response) {
	const pages = await caches.open(PAGES);

	// A redirect is the server saying no, most likely because the session has
	// ended. Nothing is kept, so an offline open does not show a signed-out
	// visitor the last account's list.
	if (!response.ok || response.type !== "basic") {
		await pages.delete(url);
		return;
	}

	const html = await response.text();
	const assets = await caches.open(ASSETS);

	try {
		await Promise.all(
			[...assetsIn(html)].map(async (file) => {
				if (!(await assets.match(file))) await assets.add(file);
			}),
		);
	} catch {
		return;
	}

	await pages.put(
		url,
		new Response(html, {
			headers: { "content-type": "text/html; charset=utf-8" },
		}),
	);
}

/** A hashed file: the cached copy, or fetch it once and keep it. */
async function fromCache(event) {
	const cache = await caches.open(ASSETS);
	const cached = await cache.match(event.request, { ignoreVary: true });
	if (cached) return cached;

	const response = await fetch(event.request);
	if (response.ok) {
		// Stored after answering, so the first load never waits on the cache.
		event.waitUntil(
			cache.put(event.request, response.clone()).then(() => trim(cache)),
		);
	}
	return response;
}

async function trim(cache) {
	const keys = await cache.keys();
	const excess = keys.length - MAX_ENTRIES;
	if (excess <= 0) return;

	await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}
