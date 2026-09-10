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
