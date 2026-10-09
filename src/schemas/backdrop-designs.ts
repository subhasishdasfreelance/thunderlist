/**
 * The backgrounds a page can have: paper cut-outs after Matisse — seaweed,
 * stars, birds, leaves — in three colours, around the edges of the page and
 * over its whole height; see `BackdropArt`.
 *
 * Each design is only a list of shapes and where they sit. A shape is placed
 * by its centre — `x` and `y` in percent of the page, so a shape can hang off
 * an edge — and sized by `size`, in percent of the page's longer side, so it
 * keeps its proportions on a phone held upright and on a wide screen alike.
 * `color` picks one of the palette's three colours, and `flip` mirrors it.
 *
 * Every shape is big: nothing small or dotted is drawn anywhere, since back
 * here it would read as a control. The outlines themselves are in
 * `backdrop-art.tsx`, which is loaded only once the page is up.
 */

const SHAPES = [
	"frond",
	"coral",
	"kelp",
	"palm",
	"monstera",
	"leaf",
	"fern",
	"star",
	"sparkle",
	"bird",
	"fish",
	"medusa",
	"shell",
	"sun",
	"moon",
	"heart",
	"seed",
	"pebble",
	"slab",
	"wave",
	"spiral",
	"flower",
	"blossom",
	"sprig",
	"plume",
	"lagoon",
	"ground",
	"sheaf",
] as const;

export type Shape = (typeof SHAPES)[number];

export type ShapeSpec = {
	shape: Shape;
	x: number;
	y: number;
	size: number;
	rotate: number;
	color: 1 | 2 | 3;
	flip: boolean;
};

/** Written short, one shape a line: shape, x, y, size, rotate, colour, mirrored. */
function s(
	shape: Shape,
	x: number,
	y: number,
	size: number,
	rotate: number,
	color: 1 | 2 | 3,
	flip = false,
): ShapeSpec {
	return { shape, x, y, size, rotate, color, flip };
}

export const DESIGNS = [
	{
		designId: "oceania",
		name: "Oceania",
		shapes: [
			s("frond", 6, 76, 26, -6, 1),
			s("coral", 92, 82, 32, 4, 2),
			s("fish", 80, 28, 18, -10, 3, true),
			s("medusa", 12, 20, 14, 8, 2),
			s("leaf", 34, 98, 14, 58, 3),
			s("star", 64, 92, 9, 12, 1),
			s("sparkle", 66, 58, 6, 0, 1),
		],
	},
	{
		designId: "lagoon",
		name: "Lagoon",
		shapes: [
			s("lagoon", 8, 90, 46, 0, 1),
			s("frond", 92, 72, 24, 10, 2),
			s("pebble", 70, 102, 22, 0, 3),
			s("sparkle", 84, 20, 9, 0, 3),
			s("leaf", 4, 28, 16, -24, 2),
			s("star", 34, 70, 6, 10, 3),
		],
	},
	{
		designId: "polynesia",
		name: "Polynesia",
		shapes: [
			s("bird", 22, 24, 20, -8, 1),
			s("bird", 78, 48, 15, 10, 1, true),
			s("fish", 86, 88, 20, 6, 2),
			s("wave", 28, 100, 56, 0, 3),
			s("sparkle", 92, 14, 8, 0, 2),
			s("star", 6, 64, 10, -10, 3),
			s("seed", 52, 18, 5, 120, 2),
		],
	},
	{
		designId: "jazz",
		name: "Jazz",
		shapes: [
			s("star", 86, 22, 20, 8, 1),
			s("slab", 8, 84, 30, -6, 2),
			s("heart", 76, 86, 22, -10, 3),
			s("spiral", 18, 22, 18, 0, 3),
			s("sparkle", 48, 96, 10, 0, 1),
			s("slab", 98, 64, 12, 12, 2),
		],
	},
	{
		designId: "icarus",
		name: "Icarus",
		shapes: [
			s("slab", 4, 100, 42, -4, 1),
			s("heart", 82, 72, 26, 8, 2),
			s("star", 10, 18, 12, -12, 3),
			s("star", 92, 14, 9, 20, 3),
			s("star", 22, 74, 9, 8, 3),
			s("star", 60, 98, 8, -16, 3),
			s("star", 52, 8, 6, 30, 3),
		],
	},
	{
		designId: "snail",
		name: "Snail",
		shapes: [
			s("spiral", 86, 82, 34, 0, 1),
			s("slab", 8, 88, 24, -8, 2),
			s("slab", 18, 12, 16, 10, 3),
			s("slab", 94, 16, 13, -6, 2),
			s("slab", 42, 106, 18, 4, 3),
			s("slab", 4, 50, 9, 16, 1),
		],
	},
	{
		designId: "gerbe",
		name: "La Gerbe",
		shapes: [
			s("sheaf", 88, 86, 44, 0, 1),
			s("sheaf", 2, 28, 26, 110, 2),
			s("leaf", 28, 98, 14, 70, 3),
			s("seed", 66, 12, 8, 160, 3),
			s("leaf", 72, 70, 9, -20, 2),
		],
	},
	{
		designId: "palmette",
		name: "Palmette",
		shapes: [
			s("palm", 10, 84, 34, 8, 1),
			s("plume", 90, 40, 30, 0, 2),
			s("seed", 68, 98, 11, 30, 3),
			s("pebble", 98, 100, 20, 0, 3),
			s("sparkle", 30, 20, 7, 0, 3),
		],
	},
	{
		designId: "monstera",
		name: "Monstera",
		shapes: [
			s("monstera", 2, 88, 40, -30, 1),
			s("monstera", 100, 16, 34, 150, 2),
			s("leaf", 84, 92, 16, -30, 3),
			s("leaf", 24, 6, 12, 120, 3),
			s("leaf", 92, 74, 12, 20, 1),
		],
	},
	{
		designId: "kelp",
		name: "Kelp",
		shapes: [
			s("kelp", 6, 80, 14, 0, 1),
			s("kelp", 15, 92, 11, 0, 2),
			s("kelp", 92, 76, 15, 0, 1, true),
			s("kelp", 84, 94, 10, 0, 3),
			s("fish", 70, 38, 15, -8, 3, true),
			s("fish", 24, 32, 11, 6, 2),
			s("pebble", 52, 108, 20, 0, 3),
		],
	},
	{
		designId: "reef",
		name: "Reef",
		shapes: [
			s("coral", 10, 84, 34, -4, 1),
			s("coral", 88, 92, 26, 6, 3),
			s("medusa", 84, 24, 16, -6, 2),
			s("fish", 46, 98, 13, 0, 2),
			s("sparkle", 22, 16, 8, 0, 3),
			s("pebble", 66, 108, 18, 0, 1),
		],
	},
	{
		designId: "constellation",
		name: "Constellation",
		shapes: [
			s("moon", 86, 24, 22, -20, 1),
			s("star", 12, 26, 14, -10, 2),
			s("star", 30, 88, 10, 14, 2),
			s("sparkle", 70, 78, 11, 0, 3),
			s("sparkle", 6, 70, 8, 0, 3),
			s("star", 94, 84, 12, 6, 2),
			s("sparkle", 50, 10, 6, 0, 2),
		],
	},
	{
		designId: "nocturne",
		name: "Nocturne",
		shapes: [
			s("moon", 12, 20, 18, 30, 1),
			s("sprig", 92, 76, 16, -6, 2),
			s("blossom", 76, 96, 16, 10, 3),
			s("sprig", 6, 90, 14, 10, 2, true),
			s("sparkle", 84, 20, 8, 0, 3),
			s("blossom", 20, 102, 10, -20, 3),
		],
	},
	{
		designId: "blossom",
		name: "Blossom",
		shapes: [
			s("blossom", 88, 22, 22, 10, 1),
			s("blossom", 10, 86, 28, -8, 2),
			s("sprig", 94, 82, 16, -10, 3),
			s("blossom", 44, 104, 14, 20, 1),
			s("leaf", 4, 24, 13, -30, 3),
			s("blossom", 70, 96, 9, -10, 3),
		],
	},
	{
		designId: "meadow",
		name: "Meadow",
		shapes: [
			s("ground", 50, 108, 120, 0, 2),
			s("flower", 18, 74, 16, 0, 1),
			s("flower", 82, 70, 13, 14, 3),
			s("sun", 88, 16, 22, 0, 3),
			s("leaf", 60, 86, 9, 20, 1),
			s("sprig", 34, 80, 8, -8, 1),
		],
	},
	{
		designId: "tide",
		name: "Tide",
		shapes: [
			s("wave", 22, 98, 64, 0, 1),
			s("wave", 80, 100, 64, 0, 2),
			s("shell", 86, 30, 18, 12, 3),
			s("fish", 14, 32, 15, -10, 2),
			s("sparkle", 54, 16, 6, 0, 3),
		],
	},
	{
		designId: "seashore",
		name: "Seashore",
		shapes: [
			s("shell", 12, 88, 24, -10, 1),
			s("pebble", 86, 92, 26, 0, 2),
			s("seed", 68, 100, 12, 60, 3),
			s("shell", 90, 20, 14, 20, 3),
			s("pebble", 6, 24, 14, 0, 2),
			s("star", 34, 102, 9, -8, 3),
		],
	},
	{
		designId: "ferns",
		name: "Ferns",
		shapes: [
			s("fern", 4, 72, 24, -14, 1),
			s("fern", 96, 80, 26, 12, 2, true),
			s("fern", 90, 8, 18, 190, 3),
			s("leaf", 12, 4, 11, 150, 3),
			s("fern", 22, 104, 14, 30, 2),
		],
	},
	{
		designId: "orchard",
		name: "Orchard",
		shapes: [
			s("seed", 88, 80, 18, 20, 1),
			s("seed", 76, 94, 13, -30, 2),
			s("leaf", 96, 58, 14, 30, 3),
			s("sprig", 6, 86, 16, 10, 3),
			s("seed", 10, 18, 11, 160, 1),
			s("leaf", 30, 100, 10, 80, 2),
		],
	},
	{
		designId: "aviary",
		name: "Aviary",
		shapes: [
			s("bird", 14, 24, 18, -10, 1),
			s("bird", 36, 12, 11, -4, 2),
			s("bird", 86, 30, 15, 12, 3, true),
			s("bird", 74, 82, 20, -6, 1, true),
			s("plume", 8, 92, 22, 0, 2),
			s("bird", 94, 62, 9, 8, 2, true),
		],
	},
	{
		designId: "seeds",
		name: "Seeds",
		shapes: [
			s("seed", 8, 84, 16, -20, 1),
			s("seed", 22, 98, 12, 30, 2),
			s("seed", 92, 70, 17, 15, 3),
			s("seed", 84, 16, 11, -150, 2),
			s("pebble", 70, 104, 18, 0, 1),
			s("seed", 4, 30, 9, 200, 3),
		],
	},
	{
		designId: "collage",
		name: "Collage",
		shapes: [
			s("slab", 6, 22, 22, 6, 1),
			s("leaf", 9, 26, 12, -20, 3),
			s("slab", 92, 84, 30, -4, 2),
			s("flower", 90, 82, 16, 10, 3),
			s("heart", 20, 92, 14, -12, 2),
			s("spiral", 92, 16, 10, 0, 1),
		],
	},
	{
		designId: "flight",
		name: "Flight",
		shapes: [
			s("plume", 90, 74, 34, 10, 1),
			s("bird", 20, 28, 18, -12, 2),
			s("sparkle", 76, 18, 9, 0, 3),
			s("sparkle", 8, 78, 8, 0, 3),
			s("bird", 42, 94, 12, 6, 3),
			s("bird", 60, 12, 8, -4, 2),
		],
	},
	{
		designId: "harvest",
		name: "Harvest",
		shapes: [
			s("sun", 86, 18, 24, 0, 1),
			s("sheaf", 12, 86, 38, 0, 2),
			s("ground", 70, 110, 100, 0, 3),
			s("leaf", 46, 90, 9, 50, 1),
		],
	},
	{
		designId: "deep",
		name: "Deep sea",
		shapes: [
			s("medusa", 84, 30, 18, -6, 1),
			s("medusa", 14, 70, 13, 10, 2),
			s("kelp", 96, 90, 13, 0, 3),
			s("sparkle", 30, 16, 7, 0, 3),
			s("pebble", 60, 106, 20, 0, 2),
			s("kelp", 4, 100, 10, 0, 1),
		],
	},
	{
		designId: "bouquet",
		name: "Bouquet",
		shapes: [
			s("flower", 84, 82, 20, 0, 1),
			s("blossom", 95, 64, 16, 20, 2),
			s("leaf", 72, 98, 14, -40, 3),
			s("palm", 8, 90, 28, 0, 3),
			s("flower", 10, 18, 11, 10, 2),
			s("leaf", 98, 92, 12, 30, 2),
		],
	},
	{
		designId: "jungle",
		name: "Jungle",
		shapes: [
			s("monstera", 96, 84, 38, 30, 1),
			s("palm", 4, 90, 32, -10, 2),
			s("bird", 76, 22, 17, -8, 3, true),
			s("leaf", 12, 14, 14, -140, 3),
			s("leaf", 52, 104, 12, 60, 1),
		],
	},
	{
		designId: "riviera",
		name: "Riviera",
		shapes: [
			s("lagoon", 92, 88, 36, 0, 1),
			s("slab", 6, 20, 19, 8, 2),
			s("star", 10, 82, 16, -10, 3),
			s("spiral", 84, 16, 13, 0, 3),
			s("leaf", 40, 100, 12, 70, 2),
		],
	},
	{
		designId: "calm",
		name: "Calm",
		shapes: [
			s("lagoon", 0, 96, 54, 0, 1),
			s("lagoon", 100, 4, 40, 180, 2),
			s("leaf", 84, 88, 14, -30, 3),
		],
	},
	{
		designId: "sunburst",
		name: "Sunburst",
		shapes: [
			s("sun", 90, 86, 40, 0, 1),
			s("star", 8, 18, 14, 0, 2),
			s("sparkle", 16, 84, 11, 0, 3),
			s("star", 72, 10, 8, 18, 3),
			s("pebble", 2, 104, 18, 0, 2),
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
	{
		paletteId: "jazz",
		name: "Jazz",
		colors: ["#2f5bd3", "#f2542d", "#f6c94c"],
	},
	{
		paletteId: "oceania",
		name: "Oceania",
		colors: ["#3a7ca5", "#81c3d7", "#d9a066"],
	},
	{
		paletteId: "snail",
		name: "Snail",
		colors: ["#f08a24", "#2a9d6f", "#d64f8d"],
	},
	{
		paletteId: "polynesia",
		name: "Polynesia",
		colors: ["#1f5fa8", "#4aa3df", "#9cc8ea"],
	},
	{
		paletteId: "riviera",
		name: "Riviera",
		colors: ["#0f7c90", "#f28a4b", "#f4cf6a"],
	},
	{
		paletteId: "fig",
		name: "Fig",
		colors: ["#7b3f6e", "#8a9a3b", "#e58fa1"],
	},
	{
		paletteId: "terracotta",
		name: "Terracotta",
		colors: ["#c8553d", "#e9a46a", "#5b8e7d"],
	},
	{
		paletteId: "grove",
		name: "Grove",
		colors: ["#f3d34a", "#6fae4f", "#2f7d6d"],
	},
	{
		paletteId: "peacock",
		name: "Peacock",
		colors: ["#136f63", "#3f88c5", "#d4b483"],
	},
	{
		paletteId: "rose",
		name: "Rose",
		colors: ["#e26d8a", "#f7b2bd", "#8bbf9f"],
	},
	{
		paletteId: "ink",
		name: "Ink",
		colors: ["#23395b", "#5c7aa6", "#c9a96e"],
	},
] as const satisfies ReadonlyArray<{
	paletteId: string;
	name: string;
	colors: readonly [string, string, string];
}>;

export type PaletteId = (typeof PALETTES)[number]["paletteId"];
