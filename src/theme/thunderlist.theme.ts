/**
 * The one place the app's colours are chosen.
 *
 * Astryx generates a whole palette from a small number of seeds — every
 * surface, border, text and icon token, in both light and dark, contrast-checked
 * against each other. The seeds below do almost all of the work; only the accent
 * family is stated by hand, and only because the generator answers a different
 * question than this app is asking (see the accent note below).
 *
 * To change the brand colour, change the four accent tokens together. Nothing
 * else needs touching.
 *
 * This file is the source, not what the app loads. `bun run theme:build`
 * compiles it to `thunderlist.css` and `thunderlist.js` beside it, and those
 * are what ship — a stylesheet the server can send with the page rather than a
 * `<style>` the browser injects on hydration, which is a flash of the wrong
 * colours on every first paint. `bun run build` recompiles it, so the two can
 * never drift.
 */

import { defineTheme } from "@astryxdesign/core/theme";

/*
 * The accent, written out rather than generated.
 *
 * Given a seed, Astryx builds a tonal palette and picks a *light* tone for the
 * dark scheme — a pale periwinkle carrying near-black text. That is a sound
 * choice and it is what the design system ships, but it is not this app: the
 * mark is a gold bolt on blue, and a washed lavender button reads as a
 * different product. Every seed from indigo through sky resolves to some
 * variant of it, so the accent is pinned instead.
 *
 * `color.accent` still takes a seed, because the generator uses it for the
 * surrounding neutrals; the four tokens below then say what the accent itself
 * is. They are chosen as a set, and the ratios are the reason:
 *
 *   • filled surfaces (`accent` + `on-accent`) — white on #2563EB is 5.3:1, and
 *     the blue itself is 3.6:1 against the dark body, so a button has an edge
 *     without a border.
 *   • text and icons get their own lighter blue in the dark scheme: the filled
 *     blue would be 3.6:1 as a word on the page, which is not enough to read.
 *
 * In the light scheme one blue does both jobs, which is why the tuples repeat.
 */
const ACCENT_SEED: [string, string] = ["#1D4ED8", "#3B82F6"];
const ACCENT_FILL: [string, string] = ["#1D4ED8", "#2563EB"];
const ACCENT_ON_FILL: [string, string] = ["#FFFFFF", "#FFFFFF"];
const ACCENT_TEXT: [string, string] = ["#1D4ED8", "#7FBBFF"];

export const thunderlistTheme = defineTheme({
	name: "thunderlist",

	color: {
		accent: ACCENT_SEED,
		// Greys with a hint of blue in them, so neutral surfaces sit under the
		// accent rather than beside it.
		neutralStyle: "cool",
	},

	// Slightly softer than the default, which suits a screen made of stacked
	// rows and cards more than a form-heavy one.
	radius: { base: 6, multiplier: 1 },

	tokens: {
		"--color-accent": ACCENT_FILL,
		"--color-on-accent": ACCENT_ON_FILL,
		"--color-text-accent": ACCENT_TEXT,
		"--color-icon-accent": ACCENT_TEXT,
	},

	components: {
		/*
		 * A progress bar has to show two things: how far along it is, and how far
		 * there is to go. The default track is a barely-there wash — near-invisible
		 * on a dark card — so the second half of that goes missing and the bar
		 * reads as a floating stripe. `--color-track` is the token meant for
		 * exactly this and is contrast-checked in both schemes.
		 */
		"progressbar-track": {
			base: { backgroundColor: "var(--color-track)" },
		},
	},
});
