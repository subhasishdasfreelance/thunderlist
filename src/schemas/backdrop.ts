import * as v from "valibot";

/**
 * The parts of the app, each with scenery of its own behind it; see
 * `sectionOf` and `.thunderlist-shell`.
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
 * The illustrations a section can have at the foot of its scenery, each a
 * file in `public/illustrations`. Every one is in the public domain (CC0), so
 * nothing is owed and nothing restricts where it goes; where each came from is
 * in `public/illustrations/LICENSES.md`.
 */
export const ILLUSTRATIONS = [
	{ illustrationId: "coffee-run", title: "Coffee run" },
	{ illustrationId: "tinkering-together", title: "Tinkering together" },
	{ illustrationId: "looking-ahead", title: "Looking ahead" },
	{ illustrationId: "bike-ride", title: "Bike ride" },
	{ illustrationId: "carrying-plants", title: "Armful of plants" },
	{ illustrationId: "happy-dance", title: "Happy dance" },
	{ illustrationId: "walking-together", title: "Walking together" },
	{ illustrationId: "armchair-reading", title: "Armchair reading" },
	{ illustrationId: "sitting-calm", title: "Calm sitting" },
	{ illustrationId: "puppy-cuddle", title: "Puppy cuddle" },
	{ illustrationId: "looking-up", title: "Looking up" },
	{ illustrationId: "reading-cross-legged", title: "Reading corner" },
	{ illustrationId: "sitting-reflecting", title: "Quiet reflection" },
] as const satisfies ReadonlyArray<{ illustrationId: string; title: string }>;

export type IllustrationId = (typeof ILLUSTRATIONS)[number]["illustrationId"];

/** What each section shows until its person picks something else. */
export const DEFAULT_BACKDROPS: Record<Section, IllustrationId | null> = {
	today: "coffee-run",
	checklists: "tinkering-together",
	priority: "looking-ahead",
	stages: "bike-ride",
	tags: "carrying-plants",
	trackers: "happy-dance",
	groups: "walking-together",
	plans: "armchair-reading",
	countdowns: "sitting-calm",
	settings: "puppy-cuddle",
};

/**
 * Which illustration each section shows, picked by the person themself —
 * `null` for none. A section never picked for is absent, and shows its
 * default.
 *
 * It is the person's own, not the space's: the same wherever they work, and
 * nobody else in a team sees it.
 */
export type Backdrops = Partial<Record<Section, IllustrationId | null>>;

/** The illustration a section shows, picked or by default. */
export function backdropOf(
	backdrops: Backdrops | undefined,
	section: Section,
): IllustrationId | null {
	const picked = backdrops?.[section];
	return picked === undefined ? DEFAULT_BACKDROPS[section] : picked;
}

export function illustrationUrl(illustrationId: IllustrationId): string {
	return `/illustrations/${illustrationId}.svg`;
}

export const setBackdropInputSchema = v.object({
	section: v.picklist(SECTIONS),
	illustrationId: v.nullable(
		v.picklist(ILLUSTRATIONS.map((each) => each.illustrationId)),
	),
});

export type SetBackdropInput = v.InferOutput<typeof setBackdropInputSchema>;
