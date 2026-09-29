import * as v from "valibot";
import {
	DESIGNS,
	type DesignId,
	PALETTES,
	type PaletteId,
} from "./backdrop-designs";

/**
 * The parts of the app, each with a background of its own; see `sectionOf`
 * and `Scenery`.
 */
export const SECTIONS = [
	"today",
	"checklists",
	"priority",
	"stages",
	"tags",
	"trackers",
	"groups",
	"plans",
	"countdowns",
	"settings",
] as const;

export type Section = (typeof SECTIONS)[number];

export const SECTION_LABELS: Record<Section, string> = {
	today: "Today",
	checklists: "Checklists",
	priority: "Priority",
	stages: "Stages",
	tags: "Tags",
	trackers: "Trackers",
	groups: "Groups",
	plans: "Plans",
	countdowns: "Countdowns",
	settings: "Settings",
};

/**
 * Each part of the app's own colours — Today warm, checklists cool — which
 * its background is drawn in until its person picks others.
 */
export const SECTION_PALETTES: Record<Section, PaletteId> = {
	today: "sherbet",
	checklists: "lagoon",
	priority: "coral",
	stages: "lilac",
	tags: "berry",
	trackers: "mint",
	groups: "dusk",
	plans: "ocean",
	countdowns: "desert",
	settings: "slate",
};

/** And the design each starts with, so no two neighbours look alike. */
const SECTION_DESIGNS: Record<Section, DesignId> = {
	today: "sunrise",
	checklists: "pebbles",
	priority: "bauhaus",
	stages: "stack",
	tags: "confetti",
	trackers: "dunes",
	groups: "orbit",
	plans: "horizon",
	countdowns: "moonrise",
	settings: "ripple",
};

/**
 * What one part of the app is drawn with: a design, or `null` for a plain
 * page; and a palette, or `null` for the part's own colours.
 */
export type Backdrop = {
	design: DesignId | null;
	palette: PaletteId | null;
};

/**
 * What each part of the app is drawn with, picked by the person themself. A
 * part never picked for is absent, and drawn as it starts.
 *
 * It is the person's own, not the space's: the same wherever they work, and
 * nobody else in a team sees it.
 */
export type Backdrops = Partial<Record<Section, Backdrop>>;

const isDesign = (value: unknown): value is DesignId =>
	DESIGNS.some((design) => design.designId === value);
const isPalette = (value: unknown): value is PaletteId =>
	PALETTES.some((palette) => palette.paletteId === value);

/**
 * What a part of the app is drawn with, picked or as it starts. Anything
 * stored that is no longer on offer is read as not picked.
 */
export function backdropOf(
	backdrops: Backdrops | undefined,
	section: Section,
): Backdrop {
	const picked: unknown = backdrops?.[section];
	const { design, palette } =
		typeof picked === "object" && picked !== null
			? (picked as Record<string, unknown>)
			: {};
	return {
		design:
			design === null
				? null
				: isDesign(design)
					? design
					: SECTION_DESIGNS[section],
		palette: isPalette(palette) ? palette : null,
	};
}

/** The three colours a part of the app is drawn in. */
export function paletteColors(
	backdrop: Backdrop,
	section: Section,
): readonly [string, string, string] {
	const paletteId = backdrop.palette ?? SECTION_PALETTES[section];
	const palette =
		PALETTES.find((each) => each.paletteId === paletteId) ?? PALETTES[0];
	return palette.colors;
}

export const setBackdropInputSchema = v.object({
	section: v.picklist(SECTIONS),
	design: v.nullable(v.picklist(DESIGNS.map((each) => each.designId))),
	palette: v.nullable(v.picklist(PALETTES.map((each) => each.paletteId))),
});

export type SetBackdropInput = v.InferOutput<typeof setBackdropInputSchema>;
