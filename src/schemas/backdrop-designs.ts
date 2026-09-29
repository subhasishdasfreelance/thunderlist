/**
 * The backgrounds a page can have: big, flat shapes in three colours, laid
 * out low on the page so its top stays clear; see `BackdropArt`.
 *
 * Each design is only a list of shapes and where they sit. A shape is placed
 * by its centre — `x` and `y` in percent of the page, so a shape can hang off
 * an edge — and sized by `size`, in percent of the page's longer side, so it
 * keeps its proportions on a phone held upright and on a wide screen alike.
 * `color` picks one of the palette's three colours; `fade` runs it into the
 * next one.
 *
 * Nothing small or dotted is drawn anywhere: back here it would read as a
 * control.
 */

export const SHAPES = [
	"disc",
	"ring",
	"blob",
	"pebble",
	"puddle",
	"capsule",
	"squircle",
	"triangle",
	"dome",
	"arch",
	"wave",
	"zigzag",
	"flower",
	"quarter",
	"diamond",
	"crescent",
	"plus",
	"stripes",
	"leaf",
	"cloud",
	"hill",
] as const;

export type Shape = (typeof SHAPES)[number];

export type ShapeSpec = {
	shape: Shape;
	x: number;
	y: number;
	size: number;
	rotate?: number;
	color: 1 | 2 | 3;
	fade?: boolean;
};

/** Written short, one shape a line: shape, x, y, size, rotate, colour. */
function s(
	shape: Shape,
	x: number,
	y: number,
	size: number,
	rotate: number,
	color: 1 | 2 | 3,
	fade = false,
): ShapeSpec {
	return { shape, x, y, size, rotate, color, fade };
}

export const DESIGNS = [
	{
		designId: "sunrise",
		name: "Sunrise",
		shapes: [
			s("disc", 12, 96, 64, 0, 1, true),
			s("blob", 94, 64, 46, -14, 3, true),
			s("ring", 58, 104, 38, 0, 3),
			s("capsule", 30, 62, 26, -32, 2),
		],
	},
	{
		designId: "pebbles",
		name: "Pebbles",
		shapes: [
			s("blob", 14, 88, 40, 0, 1),
			s("pebble", 52, 98, 34, 20, 2),
			s("puddle", 90, 80, 42, -10, 3),
			s("pebble", 72, 60, 16, 45, 1),
		],
	},
	{
		designId: "tide",
		name: "Tide",
		shapes: [
			s("wave", 50, 70, 120, 0, 1),
			s("wave", 50, 82, 120, 0, 2),
			s("wave", 50, 94, 120, 0, 3),
		],
	},
	{
		designId: "bauhaus",
		name: "Bauhaus",
		shapes: [
			s("quarter", 12, 92, 44, 0, 1),
			s("disc", 46, 90, 24, 0, 2),
			s("triangle", 80, 82, 30, 12, 3),
			s("capsule", 62, 60, 22, 0, 1),
		],
	},
	{
		designId: "arches",
		name: "Arches",
		shapes: [
			s("arch", 18, 100, 40, 0, 1),
			s("arch", 50, 100, 40, 0, 2),
			s("arch", 82, 100, 40, 0, 3),
		],
	},
	{
		designId: "orbit",
		name: "Orbit",
		shapes: [
			s("ring", 82, 82, 62, 0, 1),
			s("ring", 82, 82, 38, 0, 2),
			s("disc", 82, 82, 14, 0, 3),
			s("disc", 18, 94, 34, 0, 2, true),
		],
	},
	{
		designId: "dunes",
		name: "Dunes",
		shapes: [
			s("hill", 22, 98, 90, 0, 1, true),
			s("hill", 76, 102, 100, 0, 2, true),
			s("hill", 50, 110, 120, 0, 3),
		],
	},
	{
		designId: "petals",
		name: "Petals",
		shapes: [
			s("flower", 86, 78, 44, 15, 1),
			s("flower", 16, 94, 30, -20, 3),
			s("leaf", 55, 92, 20, 40, 2),
		],
	},
	{
		designId: "moonrise",
		name: "Moonrise",
		shapes: [
			s("crescent", 82, 62, 34, -20, 1),
			s("disc", 18, 92, 52, 0, 2, true),
			s("ring", 56, 100, 22, 0, 3),
		],
	},
	{
		designId: "confetti",
		name: "Confetti",
		shapes: [
			s("capsule", 14, 62, 18, 35, 1),
			s("triangle", 34, 88, 14, -15, 2),
			s("ring", 60, 70, 16, 0, 3),
			s("squircle", 84, 90, 18, 20, 1),
			s("dome", 90, 56, 14, -30, 2),
			s("capsule", 50, 98, 20, -20, 3),
		],
	},
	{
		designId: "stack",
		name: "Stack",
		shapes: [
			s("capsule", 82, 60, 40, -18, 1),
			s("capsule", 76, 72, 40, -18, 2),
			s("capsule", 70, 84, 40, -18, 3),
		],
	},
	{
		designId: "horizon",
		name: "Horizon",
		shapes: [
			s("disc", 50, 88, 46, 0, 1, true),
			s("hill", 50, 108, 170, 0, 2),
			s("hill", 20, 112, 90, 0, 3),
		],
	},
	{
		designId: "zigzag",
		name: "Zigzag",
		shapes: [
			s("zigzag", 50, 72, 120, 0, 1),
			s("zigzag", 50, 88, 120, 0, 2),
			s("disc", 88, 100, 26, 0, 3),
		],
	},
	{
		designId: "leaves",
		name: "Leaves",
		shapes: [
			s("leaf", 8, 80, 30, -30, 1),
			s("leaf", 22, 90, 26, 20, 2),
			s("leaf", 88, 72, 34, 25, 3),
			s("leaf", 78, 92, 24, -40, 1),
		],
	},
	{
		designId: "diamonds",
		name: "Diamonds",
		shapes: [
			s("diamond", 14, 86, 30, 0, 1),
			s("diamond", 86, 70, 36, 0, 2),
			s("diamond", 55, 100, 24, 0, 3),
		],
	},
	{
		designId: "clouds",
		name: "Clouds",
		shapes: [
			s("cloud", 20, 82, 40, 0, 1),
			s("cloud", 76, 68, 32, 0, 2),
			s("cloud", 60, 98, 48, 0, 3),
		],
	},
	{
		designId: "domes",
		name: "Domes",
		shapes: [
			s("dome", 20, 96, 50, 0, 1),
			s("dome", 80, 96, 50, 0, 2),
			s("dome", 50, 70, 22, 180, 3),
		],
	},
	{
		designId: "plus",
		name: "Plus",
		shapes: [
			s("plus", 80, 76, 34, 15, 1),
			s("plus", 18, 92, 24, -10, 2),
			s("ring", 50, 102, 30, 0, 3),
		],
	},
	{
		designId: "stripes",
		name: "Stripes",
		shapes: [
			s("stripes", 78, 78, 56, 0, 1),
			s("disc", 18, 94, 40, 0, 2, true),
			s("capsule", 44, 62, 22, -30, 3),
		],
	},
	{
		designId: "ripple",
		name: "Ripple",
		shapes: [
			s("ring", 0, 100, 50, 0, 1),
			s("ring", 0, 100, 80, 0, 2),
			s("ring", 0, 100, 110, 0, 3),
		],
	},
	{
		designId: "corner-sun",
		name: "Corner sun",
		shapes: [
			s("disc", 100, 100, 80, 0, 1, true),
			s("ring", 100, 100, 110, 0, 2),
			s("capsule", 20, 80, 24, -35, 3),
		],
	},
	{
		designId: "garden",
		name: "Garden",
		shapes: [
			s("hill", 30, 108, 100, 0, 2),
			s("flower", 70, 76, 26, 10, 1),
			s("leaf", 84, 90, 22, 30, 3),
			s("leaf", 14, 82, 20, -35, 3),
		],
	},
	{
		designId: "tiles",
		name: "Tiles",
		shapes: [
			s("squircle", 14, 80, 30, 12, 1),
			s("squircle", 30, 96, 26, -8, 2),
			s("squircle", 86, 76, 34, 20, 3),
		],
	},
	{
		designId: "comet",
		name: "Comet",
		shapes: [
			s("capsule", 58, 72, 72, -25, 1, true),
			s("disc", 88, 58, 18, 0, 2),
			s("ring", 16, 98, 26, 0, 3),
		],
	},
	{
		designId: "twins",
		name: "Twins",
		shapes: [s("disc", 30, 92, 50, 0, 1), s("disc", 70, 92, 50, 0, 2)],
	},
	{
		designId: "peaks",
		name: "Peaks",
		shapes: [
			s("triangle", 14, 92, 40, -10, 1),
			s("triangle", 50, 100, 30, 15, 2),
			s("triangle", 86, 84, 44, 30, 3),
		],
	},
	{
		designId: "sunset-sea",
		name: "Sunset sea",
		shapes: [
			s("disc", 70, 72, 36, 0, 1),
			s("wave", 50, 88, 120, 0, 2),
			s("wave", 50, 100, 120, 0, 3),
		],
	},
	{
		designId: "bubbles",
		name: "Bubbles",
		shapes: [
			s("disc", 10, 80, 24, 0, 1),
			s("disc", 30, 98, 32, 0, 2),
			s("disc", 80, 70, 28, 0, 3),
			s("disc", 94, 94, 22, 0, 1),
			s("disc", 56, 86, 16, 0, 2),
		],
	},
	{
		designId: "crescents",
		name: "Crescents",
		shapes: [
			s("crescent", 14, 86, 30, 30, 1),
			s("crescent", 86, 78, 38, -150, 2),
			s("dome", 50, 104, 34, 0, 3),
		],
	},
	{
		designId: "ribbon",
		name: "Ribbon",
		shapes: [s("wave", 50, 78, 140, -12, 1), s("wave", 50, 92, 140, -12, 3)],
	},
	{
		designId: "steps",
		name: "Steps",
		shapes: [
			s("squircle", 70, 100, 30, 0, 1),
			s("squircle", 86, 84, 30, 0, 2),
			s("squircle", 102, 68, 30, 0, 3),
		],
	},
	{
		designId: "blossom",
		name: "Blossom",
		shapes: [
			s("flower", 80, 80, 60, 10, 1),
			s("disc", 80, 80, 16, 0, 2),
			s("leaf", 20, 94, 26, -25, 3),
		],
	},
	{
		designId: "eclipse",
		name: "Eclipse",
		shapes: [
			s("disc", 72, 76, 44, 0, 1),
			s("disc", 80, 70, 40, 0, 2),
			s("ring", 18, 98, 30, 0, 3),
		],
	},
	{
		designId: "kites",
		name: "Kites",
		shapes: [
			s("diamond", 20, 76, 22, 12, 1),
			s("diamond", 82, 66, 26, -12, 2),
			s("capsule", 52, 94, 30, 20, 3),
		],
	},
	{
		designId: "archway",
		name: "Archway",
		shapes: [
			s("arch", 50, 104, 90, 0, 1),
			s("arch", 50, 104, 60, 0, 2),
			s("arch", 50, 104, 30, 0, 3),
		],
	},
	{
		designId: "meadow",
		name: "Meadow",
		shapes: [
			s("hill", 20, 104, 80, 0, 2, true),
			s("hill", 80, 102, 90, 0, 3, true),
			s("flower", 70, 80, 16, 0, 1),
			s("flower", 30, 86, 12, 20, 1),
		],
	},
	{
		designId: "lagoon",
		name: "Lagoon",
		shapes: [
			s("puddle", 30, 94, 70, 8, 1, true),
			s("pebble", 82, 72, 26, -20, 2),
			s("wave", 70, 100, 80, 0, 3),
		],
	},
	{
		designId: "cosmos",
		name: "Cosmos",
		shapes: [
			s("disc", 84, 64, 26, 0, 1, true),
			s("ring", 84, 64, 42, -20, 2),
			s("crescent", 16, 88, 28, 20, 3),
			s("disc", 40, 100, 30, 0, 2),
		],
	},
] as const satisfies ReadonlyArray<{
	designId: string;
	name: string;
	shapes: ReadonlyArray<ShapeSpec>;
}>;

export type DesignId = (typeof DESIGNS)[number]["designId"];

/**
 * The colours a background can be drawn in, three apiece. Each part of the
 * app starts in one of its own; see `SECTION_PALETTES`.
 */
export const PALETTES = [
	{
		paletteId: "sherbet",
		name: "Sherbet",
		colors: ["#ffd166", "#ff8a5b", "#ff8fc7"],
	},
	{
		paletteId: "lagoon",
		name: "Lagoon",
		colors: ["#7c8cff", "#4fd1e8", "#9ef0c9"],
	},
	{
		paletteId: "berry",
		name: "Berry",
		colors: ["#ff7eb6", "#a78bfa", "#ffc58a"],
	},
	{
		paletteId: "citrus",
		name: "Citrus",
		colors: ["#c6f16d", "#ffd166", "#ff9f6b"],
	},
	{
		paletteId: "mint",
		name: "Mint",
		colors: ["#3ddc97", "#c6f16d", "#4fd1e8"],
	},
	{
		paletteId: "dusk",
		name: "Dusk",
		colors: ["#a78bfa", "#ff6b9a", "#ff9f6b"],
	},
	{
		paletteId: "lilac",
		name: "Lilac",
		colors: ["#b794f6", "#f9a8d4", "#7c8cff"],
	},
	{
		paletteId: "coral",
		name: "Coral",
		colors: ["#ff6b6b", "#ffd166", "#ff9f7a"],
	},
	{
		paletteId: "ocean",
		name: "Ocean",
		colors: ["#3b82f6", "#22d3ee", "#818cf8"],
	},
	{
		paletteId: "forest",
		name: "Forest",
		colors: ["#2e9e62", "#a3e635", "#86efac"],
	},
	{
		paletteId: "neon",
		name: "Neon",
		colors: ["#22d3ee", "#e879f9", "#a3e635"],
	},
	{
		paletteId: "desert",
		name: "Desert",
		colors: ["#e9c46a", "#f4a261", "#e76f51"],
	},
	{
		paletteId: "slate",
		name: "Slate",
		colors: ["#94a3b8", "#7c8cff", "#9ef0c9"],
	},
] as const satisfies ReadonlyArray<{
	paletteId: string;
	name: string;
	colors: readonly [string, string, string];
}>;

export type PaletteId = (typeof PALETTES)[number]["paletteId"];
