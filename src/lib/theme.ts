/**
 * Light, dark, or whatever the machine is set to.
 *
 * Every Astryx colour is declared with CSS `light-dark()`, so the whole palette
 * follows the `color-scheme` of the root element and there is nothing to
 * recolour by hand: setting one property switches the app, and the values on
 * either side are the ones Astryx has already contrast-checked.
 *
 * The choice is per browser rather than per account — it is a property of the
 * screen you are looking at, not of the data.
 */

import { useSyncExternalStore } from "react";

export const COLOR_SCHEMES = ["system", "light", "dark"] as const;

export type ColorScheme = (typeof COLOR_SCHEMES)[number];

export const STORAGE_KEY = "thunderlist.theme.v1";

/** What `color-scheme` has to say for each choice. */
function cssValue(scheme: ColorScheme): string {
	return scheme === "system" ? "light dark" : scheme;
}

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
)});document.documentElement.style.colorScheme=s==="light"||s==="dark"?s:"light dark"}catch(e){}`;

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

function apply(scheme: ColorScheme): void {
	document.documentElement.style.colorScheme = cssValue(scheme);
}

function hydrate(): void {
	if (isHydrated) return;
	isHydrated = true;
	current = read();
	apply(current);
}

export function setColorScheme(scheme: ColorScheme): void {
	current = scheme;
	apply(scheme);

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
