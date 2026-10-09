/**
 * The colours the background's cut-outs are actually drawn in: each palette
 * colour turned into a sheet of soft paper, one for a light page and one for a
 * dark one; see `BackdropArt`.
 *
 * Text and buttons sit straight on the background, so its colours have to
 * keep them legible whatever is picked. Each colour keeps its hue, but its
 * lightness is moved into a fixed band — pale on a light page, deep on a dark
 * one — and its strength is capped, so every sheet reads as a calm tint
 * rather than a loud colour. The bands are set so the app's secondary text and
 * its accent stay at WCAG AA (4.5:1) on any sheet; `paper.test.ts` checks
 * every palette against them.
 *
 * Worked out in OKLCH, where lightness is lightness as the eye sees it, so a
 * yellow and a blue in the same band look equally light.
 */

type Band = { from: number; to: number; chroma: number };

/** Pale sheets on a light page; a palette's lighter colours stay lighter. */
const LIGHT: Band = { from: 0.89, to: 0.945, chroma: 0.06 };

/** Deep sheets on a dark page, just lifted off it. */
const DARK: Band = { from: 0.26, to: 0.33, chroma: 0.05 };

/** A colour's paper for a light and a dark page, as one CSS colour. */
export function paper(hex: string): string {
	return `light-dark(${paperFor(hex, LIGHT)}, ${paperFor(hex, DARK)})`;
}

/** Exported for `paper.test.ts`, which checks the contrast of each. */
export function paperFor(hex: string, band: Band): string {
	const [l, c, h] = toOklch(hex);
	// Where the colour sits between dark and light, kept within the band.
	const t = Math.min(1, Math.max(0, (l - 0.4) / 0.55));
	const lightness = band.from + t * (band.to - band.from);
	let chroma = Math.min(c, band.chroma);
	// Less colour until it can be shown on a screen at all.
	while (chroma > 0 && !inGamut(fromOklch(lightness, chroma, h))) {
		chroma -= 0.002;
	}
	return toHex(fromOklch(lightness, Math.max(0, chroma), h));
}

export const PAPER_BANDS = { light: LIGHT, dark: DARK };

type Rgb = [number, number, number];

const toLinear = (v: number) =>
	v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const fromLinear = (v: number) =>
	v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;

function toOklch(hex: string): Rgb {
	const [r, g, b] = [1, 3, 5].map((i) =>
		toLinear(Number.parseInt(hex.slice(i, i + 2), 16) / 255),
	);
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
	const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
	const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
	return [L, Math.hypot(a, bb), Math.atan2(bb, a)];
}

/** Linear RGB, which may fall outside 0–1 if the colour cannot be shown. */
function fromOklch(L: number, C: number, h: number): Rgb {
	const a = C * Math.cos(h);
	const b = C * Math.sin(h);
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

function toHex(rgb: Rgb): string {
	return `#${rgb
		.map((v) =>
			Math.round(fromLinear(Math.min(1, Math.max(0, v))) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}
