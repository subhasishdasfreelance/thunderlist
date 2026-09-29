import * as v from "valibot";
import {
	DESIGNS,
	type DesignId,
	PALETTES,
	type PaletteId,
} from "./backdrop-designs";

/**
 * The parts of the app, each with the background its pages start with; see
 * `pageOf` and `Scenery`.
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
 * One page of the app, for its background: `key` names the page itself, and
 * `section` the part of the app it is in, which gives it the colours and design
 * it starts with.
 *
 * A list page's key is its section's (`checklists`), and one item's page adds
 * the item's id (`checklists/chk_…`). Today is a tag, but it is the app's home,
 * so it is a page of its own.
 */
export type Page = { key: string; section: Section };

const TODAY: Page = { key: "today", section: "today" };

/** The page a path is on. Anywhere that is not a section — signing in — is dressed as Today. */
export function pageOf(pathname: string): Page {
	const [first, second] = pathname.split("/").filter(Boolean);
	if (first === "tags" && second === "today") return TODAY;

	const section = SECTIONS.find((each) => each === first);
	if (section === undefined) return TODAY;

	return {
		key: second === undefined ? section : `${section}/${second}`,
		section,
	};
}

/** What one item is called, for the sections whose items have pages. */
const ITEM_NOUNS: Partial<Record<Section, string>> = {
	checklists: "checklist",
	tags: "tag",
	trackers: "tracker",
	groups: "group",
	plans: "plan",
};

/** A page as its background dialog names it: `Checklists`, or `this checklist`. */
export function pageLabel(page: Page): string {
	if (page.key === page.section) return SECTION_LABELS[page.section];
	if (page.key === "tags/untagged") return "Untagged";
	return `this ${ITEM_NOUNS[page.section] ?? "page"}`;
}

/**
 * For a list page whose items have pages of their own, what one is called;
 * those items follow the list's background until given one. `null` otherwise.
 */
export function followerNoun(page: Page): string | null {
	return page.key === page.section ? (ITEM_NOUNS[page.section] ?? null) : null;
}

/**
 * What one page is drawn with: a design, or `null` for a plain
 * page; and a palette, or `null` for the part's own colours.
 */
export type Backdrop = {
	design: DesignId | null;
	palette: PaletteId | null;
};

/**
 * What each page is drawn with, picked by the person themself and keyed by
 * `Page.key`. A page never picked for is absent: one item's page is then drawn
 * as its list page is, and a list page as its section starts.
 *
 * It is the person's own, not the space's: the same wherever they work, and
 * nobody else in a team sees it.
 */
export type Backdrops = Partial<Record<string, Backdrop>>;

const isDesign = (value: unknown): value is DesignId =>
	DESIGNS.some((design) => design.designId === value);
const isPalette = (value: unknown): value is PaletteId =>
	PALETTES.some((palette) => palette.paletteId === value);

/**
 * What a page is drawn with: picked for it, else for its list page, else as its
 * section starts. Anything stored that is no longer on offer is read as not
 * picked.
 */
export function backdropOf(
	backdrops: Backdrops | undefined,
	{ key, section }: Page,
): Backdrop {
	const picked: unknown = backdrops?.[key] ?? backdrops?.[section];
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

/** The three colours a page in this section is drawn in. */
export function paletteColors(
	backdrop: Backdrop,
	section: Section,
): readonly [string, string, string] {
	const paletteId = backdrop.palette ?? SECTION_PALETTES[section];
	const palette =
		PALETTES.find((each) => each.paletteId === paletteId) ?? PALETTES[0];
	return palette.colors;
}

/**
 * A section, then optionally one item's id. It becomes part of a Mongo field
 * path, so it can hold neither a dot nor a dollar.
 */
const PAGE_KEY = new RegExp(`^(${SECTIONS.join("|")})(/[A-Za-z0-9_-]{1,64})?$`);

export const setBackdropInputSchema = v.object({
	page: v.pipe(v.string(), v.regex(PAGE_KEY)),
	design: v.nullable(v.picklist(DESIGNS.map((each) => each.designId))),
	palette: v.nullable(v.picklist(PALETTES.map((each) => each.paletteId))),
});

export type SetBackdropInput = v.InferOutput<typeof setBackdropInputSchema>;
