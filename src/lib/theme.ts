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
 */

import { useSyncExternalStore } from "react";

const COLOR_SCHEMES = ["system", "light", "dark"] as const;

export type ColorScheme = (typeof COLOR_SCHEMES)[number];

const STORAGE_KEY = "thunderlist.theme.v1";

/**
 * The phone's status bar, painted the colour of the page under the top bar.
 * Android picks light or dark text for it from how light this colour is.
 *
 * One `theme-color` tag, set from the scheme in force. A pair with `media`
 * queries would need no script, but Chrome on Android ignores `media` there
 * and takes the first tag, which left a light bar over the app in dark mode.
 *
 * The installed app on Android ignores this tag and uses `theme_color` from
 * `public/manifest.webmanifest`, which holds a single colour for both modes:
 * the dark one, by choice. This tag still sets the bar in a browser tab.
 */
export const STATUS_BAR_COLORS = { light: "#F1F0F9", dark: "#0F1018" } as const;

const DARK_QUERY = "(prefers-color-scheme: dark)";

function isColorScheme(value: unknown): value is ColorScheme {
	return (COLOR_SCHEMES as ReadonlyArray<unknown>).includes(value);
}

/**
 * The script that runs before the first paint.
 *
 * Without it the page renders in the default scheme and then corrects itself,
 * which is a white flash for anyone who chose dark. It is inlined into the
 * document head, so it is written as a string and kept tiny.
 */
export const THEME_INIT_SCRIPT = `try{var s=localStorage.getItem(${JSON.stringify(
	STORAGE_KEY,
)});if(s==="light"||s==="dark")document.documentElement.setAttribute("data-theme",s);var d=s==="dark"||(s!=="light"&&matchMedia(${JSON.stringify(
	DARK_QUERY,
)}).matches),m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",${JSON.stringify(
	STATUS_BAR_COLORS,
)}[d?"dark":"light"])}catch(e){}`;

/** Point the `theme-color` tag at the scheme in force. */
function paintStatusBar(scheme: ColorScheme): void {
	const isDark =
		scheme === "dark" ||
		(scheme === "system" && window.matchMedia(DARK_QUERY).matches);

	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute("content", STATUS_BAR_COLORS[isDark ? "dark" : "light"]);
}

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

	// Following the system, the status bar has to follow it when it changes too.
	window
		.matchMedia(DARK_QUERY)
		.addEventListener("change", () => paintStatusBar(current));
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
	paintStatusBar(scheme);

	try {
		localStorage.setItem(STORAGE_KEY, scheme);
	} catch {
		// Not being able to remember it is not a reason to refuse to switch.
	}

	emit();
}

function subscribe(listener: () => void): () => void {
	hydrate();
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/**
 * The chosen scheme. `"system"` on the server and on the very first client
 * render, so the markup the server sent and the markup React first builds
 * agree; the stored choice arrives immediately afterwards.
 */
export function useColorScheme(): ColorScheme {
	return useSyncExternalStore(
		subscribe,
		() => current,
		() => "system" as const,
	);
}
