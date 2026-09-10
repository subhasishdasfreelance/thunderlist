/*
 * Thunderlist's service worker. Registered from `src/routes/__root.tsx`, in
 * production builds only.
 *
 * Two jobs, both about speed:
 *
 * 1. The bundle. Everything under `/assets/` is named after a hash of its
 *    content, so a file of a given name never changes. Those are answered from
 *    the cache without touching the network, which is what makes relaunching
 *    the installed app quick: only the page itself has to travel.
 *
 * 2. Pages. Every page carries data that has to be current, so a page always
 *    comes from the network and never from the cache. Navigation preload
 *    starts that request while this worker is still waking up, rather than
 *    making the page wait for it.
 *
 * Nothing else is touched. Server functions, sign-in and anything from another
 * origin go to the network exactly as if this file did not exist.
 */

const CACHE = "thunderlist-assets-v1";

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
					.filter((name) => name !== CACHE)
					.map((name) => caches.delete(name)),
			);

			await self.clients.claim();
		})(),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;

	if (request.mode === "navigate") {
		event.respondWith(fromNetwork(event));
		return;
	}

	const url = new URL(request.url);
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

/** A hashed file: the cached copy, or fetch it once and keep it. */
async function fromCache(event) {
	const cache = await caches.open(CACHE);
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
