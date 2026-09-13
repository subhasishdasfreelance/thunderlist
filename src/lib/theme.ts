/**
 * Light, dark, or whatever the machine is set to.
 *
 * The choice is handed to Astryx's `Theme`, which owns the colour scheme: it
 * writes `data-theme` on the root, and the design system's reset maps that to
 * `color-scheme` so `light-dark()` values, scrollbars and native controls all
 * follow together. Setting `color-scheme` here as well would fight it — the
 * theme's own wrapper sits inside the root, so its value wins for everything
 * drawn within, and the toggle would appear to do nothing.
 *
 * The choice is per browser rather than per account: it is a property of the
 * screen you are looking at, not of the data.
 *
 * It is kept twice: in local storage, which the script before the first paint
 * reads, and in a cookie, which the server reads so it can draw the page in
 * the chosen scheme. Without the cookie the server drew every page in the
 * machine's scheme, and the chosen one only arrived after hydration — a flash
 * of the other scheme on every full load, which a reload after a deploy or a
 * new service worker made look like it happened on changing screens.
 */

import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { useSyncExternalStore } from "react";

const COLOR_SCHEMES = ["system", "light", "dark"] as const;

export type ColorScheme = (typeof COLOR_SCHEMES)[number];

const STORAGE_KEY = "thunderlist.theme.v1";

/** Read by the server; see the top of this file. */
const COOKIE_NAME = "thunderlist-theme";

function isColorScheme(value: unknown): value is ColorScheme {
	return (COLOR_SCHEMES as ReadonlyArray<unknown>).includes(value);
}

function writeCookie(scheme: ColorScheme): void {
	// biome-ignore lint/suspicious/noDocumentCookie: one short-lived preference; the Cookie Store API is not in every browser this supports.
	document.cookie = `${COOKIE_NAME}=${scheme}; path=/; max-age=31536000; samesite=lax`;
}

function readCookie(): string | undefined {
	return document.cookie
		.split("; ")
		.find((pair) => pair.startsWith(`${COOKIE_NAME}=`))
		?.slice(COOKIE_NAME.length + 1);
}

/**
 * The scheme the page is drawn in by the server, which hydration has to agree
 * with.
 *
 * On the server that is the cookie. In the browser it is read back off the
 * markup the server sent rather than off the cookie, because the installed app
 * can open on a kept copy of a page drawn before the choice last changed — and
 * hydration must match the markup it finds, not the choice.
 */
export const drawnColorScheme = createIsomorphicFn()
	.server((): ColorScheme => {
		const stored = getCookie(COOKIE_NAME);
		return isColorScheme(stored) ? stored : "system";
	})
	.client((): ColorScheme => {
		const drawn = document
			.querySelector("[data-astryx-theme]")
			?.getAttribute("data-theme");
		return isColorScheme(drawn) ? drawn : "system";
	});

/**
 * The script that runs before the first paint.
 *
 * Without it the page renders in the default scheme and then corrects itself,
 * which is a white flash for anyone who chose dark. It is inlined into the
 * document head, so it is written as a string and kept tiny.
 */
export const THEME_INIT_SCRIPT = `try{var s=localStorage.getItem(${JSON.stringify(
	STORAGE_KEY,
)});if(s==="light"||s==="dark")document.documentElement.setAttribute("data-theme",s)}catch(e){}`;

let current: ColorScheme = "system";
let isHydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
	for (const listener of listeners) listener();
}

function read(): ColorScheme {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return isColorScheme(stored) ? stored : "system";
	} catch {
		// Private browsing, or storage turned off. The default is still fine.
		return "system";
	}
}

function hydrate(): void {
	if (isHydrated) return;
	isHydrated = true;
	current = read();

	// A choice made before the cookie existed reaches the server from now on.
	if (current !== "system" && readCookie() !== current) writeCookie(current);
}

/** How long the whole page is allowed to cross-fade between schemes. */
const CHANGE_MS = 420;

let changeTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Mark the document as changing scheme for the length of the change.
 *
 * `styles.css` hangs one blanket colour transition off this attribute. It is
 * put on for a moment rather than left there because a page that eases every
 * colour all the time is a page where hovering a row lags behind the pointer.
 */
function easeTheChange(): void {
	const root = document.documentElement;
	root.setAttribute("data-theme-changing", "");

	clearTimeout(changeTimer);
	changeTimer = setTimeout(() => {
		root.removeAttribute("data-theme-changing");
	}, CHANGE_MS);
}

export function setColorScheme(scheme: ColorScheme): void {
	if (scheme === current) return;

	current = scheme;
	easeTheChange();

	try {
		localStorage.setItem(STORAGE_KEY, scheme);
	} catch {
		// Not being able to remember it is not a reason to refuse to switch.
	}
	writeCookie(scheme);

	emit();
}

function subscribe(listener: () => void): () => void {
	hydrate();
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/**
 * The chosen scheme.
 *
 * `drawnIn` is the scheme the server drew the page in — see
 * `drawnColorScheme` — which the server renders and hydration starts from, so
 * the two agree. It is the stored choice in all but the rarest case, so
 * nothing changes once the stored choice is read after hydration.
 */
export function useColorScheme(drawnIn: ColorScheme): ColorScheme {
	return useSyncExternalStore(
		subscribe,
		() => (isHydrated ? current : drawnIn),
		() => drawnIn,
	);
}
