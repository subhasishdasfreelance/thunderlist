import { describe, expect, it } from "bun:test";
import { PALETTES } from "#/schemas/backdrop-designs";
import { PAPER_BANDS, paperFor } from "./paper";

/**
 * The text drawn straight on the background, from the theme's
 * `--color-text-*` (see `src/theme/thunderlist.css`): secondary text such as
 * "3 yet to complete", and the accent of links and ghost buttons.
 */
const TEXT = {
	light: { primary: "#1c1b21", secondary: "#474552", accent: "#1d4ed8" },
	dark: { primary: "#e1e2ec", secondary: "#a8aab9", accent: "#7fbbff" },
};

/** How much the paper's grain can darken a sheet, at its darkest. */
const GRAIN = 0.055;

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: number, b: number) =>
	(Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe("paper", () => {
	const colors = PALETTES.flatMap((palette) => palette.colors);

	for (const scheme of ["light", "dark"] as const) {
		it(`keeps text at AA on every ${scheme} sheet, grain and all`, () => {
			for (const color of colors) {
				const sheet = luminance(paperFor(color, PAPER_BANDS[scheme]));
				// The grain only darkens, which is the worse case on a light page.
				const worst = scheme === "light" ? sheet * (1 - GRAIN) : sheet;
				for (const text of Object.values(TEXT[scheme])) {
					expect(contrast(worst, luminance(text))).toBeGreaterThanOrEqual(4.5);
				}
			}
		});
	}

	it("keeps a palette's three colours apart", () => {
		for (const palette of PALETTES) {
			const sheets = new Set(
				palette.colors.map((color) => paperFor(color, PAPER_BANDS.light)),
			);
			expect(sheets.size).toBe(3);
		}
	});
});
