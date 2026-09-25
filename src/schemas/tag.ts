import * as v from "valibot";
import { accessSchema } from "./access";
import type { ChecklistProgress, StagePart } from "./checklist";
import {
	dailyWindowSchema,
	dateOnlySchema,
	descriptionSchema,
	emailSchema,
	idSchema,
	timeOfDaySchema,
	todayDateOnly,
} from "./common";
import type { Task } from "./task";
import type { TrackerSummary } from "./tracker";

/*
 * Six colours beyond the ten Astryx's `Token` ships with; see `TAG_COLORS`.
 *
 * Declaring them here is what lets a tag, a stage or a type hand its colour
 * straight to a `Token` and be type-checked. What they look like is in
 * `styles.css`, beside the marks they share their contrast budget with.
 */
declare module "@astryxdesign/core/Token" {
	interface TokenColorMap {
		rose: true;
		magenta: true;
		indigo: true;
		lime: true;
		brown: true;
		slate: true;
	}
}

/**
 * The colours a tag, a stage or a task type can be, as a ring: red round to
 * brown, then the two neutrals.
 *
 * Ten of them are the Astryx `Token` palette, so a tag renders the same
 * everywhere without a lookup table of hex values. The other six are this
 * app's, filling the gaps that ring had — a list of ten stages ran out of
 * colours before it ran out of stages, and two that were only a shade apart
 * were no help on a bar a few pixels tall.
 *
 * They are in order round the wheel rather than in any order of preference,
 * because that is the order a colour is looked for in.
 *
 * Every one of them is contrast-checked against the page in both schemes,
 * twice over: as a chip, where the text sits on a wash of it, and as a mark —
 * the dot, the bar, the checkbox — where the colour is the thing being seen.
 * See `--thunderlist-mark-*` in `styles.css`.
 */
export const TAG_COLORS = [
	"red",
	"rose",
	"pink",
	"magenta",
	"purple",
	"indigo",
	"blue",
	"cyan",
	"teal",
	"green",
	"lime",
	"yellow",
	"orange",
	"brown",
	"slate",
	"gray",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

/**
 * The colours offered when one is picked: eight that stay clearly apart from
 * each other and from the track of a bar. The rest of `TAG_COLORS` are still
 * accepted, for whatever wears one from before, and draw as the nearest of
 * these; see `--thunderlist-color-*` in `styles.css`.
 */
export const PICKABLE_COLORS = [
	"red",
	"orange",
	"yellow",
	"green",
	"teal",
	"blue",
	"purple",
	"pink",
] as const satisfies ReadonlyArray<TagColor>;

const NEAREST_PICKABLE: Partial<Record<TagColor, TagColor>> = {
	rose: "red",
	brown: "orange",
	lime: "green",
	cyan: "teal",
	slate: "blue",
	indigo: "purple",
	magenta: "pink",
};

/** A colour as the picker shows it: a retired one as the one it draws as. */
export function pickableColor(color: TagColor): TagColor {
	return NEAREST_PICKABLE[color] ?? color;
}

const tagColorSchema = v.picklist(TAG_COLORS);

/**
 * The tag every account has and cannot lose: what you are doing today.
 *
 * It is a tag in every other way — a name and a colour, both changeable on the
 * Tags screen — but the row's bolt writes it into a task's title, so it has to
 * exist and cannot be deleted. It is known by its kind rather than its name,
 * because the name is the user's to change.
 *
 * The Backlog was the other, and is a checklist now; see `ensureBacklog`.
 */
export const SPECIAL_TAGS = ["today"] as const;

export type SpecialTag = (typeof SPECIAL_TAGS)[number];

const tagNameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "Tag name is required"),
	v.maxLength(40, "Tag name must be 40 characters or fewer"),
);

/**
 * A tag.
 *
 * Tasks reference a tag by id, never by name, so renaming a tag is a single
 * document write rather than a rewrite of every task that carries it.
 *
 * A tag is a checklist that gathers its tasks by label rather than by holding
 * them, so it can carry the same schedule. Unlike a checklist's, every part of
 * it is optional: a tag is usually born mid-sentence as `#name`, with no form
 * to fill in.
 */
const tagSchema = v.object({
	tagId: idSchema,
	name: tagNameSchema,
	color: tagColorSchema,
	/** Which special tag this is, or `null` for any other; see `SPECIAL_TAGS`. */
	special: v.optional(v.nullable(v.picklist(SPECIAL_TAGS)), null),
	description: v.string(),
	/** The day the work started, or `null` to count from the day it was made. */
	startDate: v.nullable(dateOnlySchema),
	/** The day it should be finished by. Without one there is no pace. */
	deadline: v.nullable(dateOnlySchema),
	/** The time on the deadline day it is due by; see `Checklist.deadlineTime`. */
	deadlineTime: v.optional(v.nullable(timeOfDaySchema)),
	/**
	 * The hours of every day it is worked in, when it repeats daily; see
	 * `dailyWindowSchema`. Today starts with 06:00 to 22:00.
	 */
	dailyWindow: v.optional(v.nullable(dailyWindowSchema)),
	/**
	 * In a team, who may do what with it and the tasks that live under it;
	 * absent or `null` for everyone, each at whatever their role allows. Never
	 * set on Today, which is everyone's. See `accessSchema`.
	 */
	access: v.optional(accessSchema),
	createdAt: v.string(),
	updatedAt: v.string(),
});

export type Tag = v.InferOutput<typeof tagSchema>;

/**
 * The day a tag's figures are measured from.
 *
 * Its own start date when one was set, otherwise the day it was made — the
 * same day a checklist's start date defaults to.
 */
export function tagStartDate(
	tag: Pick<Tag, "startDate" | "createdAt">,
): string {
	return tag.startDate ?? todayDateOnly(new Date(tag.createdAt));
}

/**
 * The tags behind a list of ids, in the same order, skipping any that no
 * longer exist.
 */
export function tagsFor(
	tagIds: ReadonlyArray<string>,
	tags: ReadonlyArray<Tag>,
): Array<Tag> {
	return tagIds.flatMap(
		(tagId) => tags.find((tag) => tag.tagId === tagId) ?? [],
	);
}

/** The account's tag of one special kind, once the tags have loaded. */
export function specialTag(
	tags: ReadonlyArray<Tag>,
	kind: SpecialTag,
): Tag | null {
	return tags.find((tag) => tag.special === kind) ?? null;
}

/**
 * The `$tagId` in a tag's address. A special tag answers to its kind —
 * `/tags/today` — so its page is at the same address in every account, which
 * is what lets the app open on it.
 */
export function tagParam(tag: Pick<Tag, "tagId" | "special">): string {
	return tag.special ?? tag.tagId;
}

/**
 * A tag's progress: counted as a checklist's is, and how many of its open
 * tasks are under way — past the first stage of their checklist; see
 * `isUnderway`.
 */
export type TagProgress = ChecklistProgress & { inProgress: number };

/** A tag with its progress; its pace is judged in the browser, see `usePace`. */
export type TagSummary = Tag & {
	progress: TagProgress;
};

/**
 * A tag's bar in parts, drawn the way a checklist's is: done, then every task
 * under way as one part, whatever its stage — review, QA — since the
 * checklists a tag gathers from each have stages of their own. What is left of
 * the track is the work not started. Under way is left out while nothing is,
 * so a tag whose tasks only ever go from to do to done reads as a plain bar.
 */
export function tagStageParts(
	// No `inProgress` on a summary read before it carried one: a page kept from
	// the last version of the app draws what is done rather than breaking.
	progress: Pick<ChecklistProgress, "completed"> & { inProgress?: number },
): Array<StagePart> {
	const inProgress = progress.inProgress ?? 0;

	return [
		{
			stageId: "done",
			name: "Done",
			color: "green",
			count: progress.completed,
		},
		...(inProgress === 0
			? []
			: [
					{
						/*
						 * Amber for under way against green for done, the way a signal
						 * reads. Blue sat too close to the green beside it on a bar a
						 * few pixels tall — and too close to the app's own accent, which
						 * means something else entirely.
						 */
						stageId: "underway",
						name: "In progress",
						color: "orange" as const,
						count: inProgress,
					},
				]),
	];
}

/** A task carrying a tag, with the checklist it lives in, if any. */
export type TagTaskEntry = {
	task: Task;
	/** `null` for a task that belongs to no checklist. */
	checklistId: string | null;
	checklistTitle: string | null;
};

/** A tracker carrying a tag, with the day it reached its target. */
export type TagTrackerEntry = {
	tracker: TrackerSummary;
	/** `YYYY-MM-DD`, or `null` while the target is still ahead. */
	completedOn: string | null;
};

/**
 * A tag's page, less its tasks: those are read a page at a time, though
 * `progress` counts them all; see `getTagOpenTasks`.
 */
export type TagDetail = TagSummary & {
	/** Each counts once towards the tag's progress, the way a task does. */
	trackers: Array<TagTrackerEntry>;
};

export const createTagInputSchema = v.object({
	tagId: idSchema,
	name: tagNameSchema,
	color: tagColorSchema,
	description: v.optional(descriptionSchema, ""),
	startDate: v.optional(v.nullable(dateOnlySchema), null),
	deadline: v.optional(v.nullable(dateOnlySchema), null),
	deadlineTime: v.optional(v.nullable(timeOfDaySchema), null),
	dailyWindow: v.optional(v.nullable(dailyWindowSchema), null),
	access: v.optional(accessSchema, null),
});

export const updateTagInputSchema = v.object({
	tagId: idSchema,
	patch: v.pipe(
		v.object({
			name: v.optional(tagNameSchema),
			color: v.optional(tagColorSchema),
			description: v.optional(descriptionSchema),
			startDate: v.optional(v.nullable(dateOnlySchema)),
			deadline: v.optional(v.nullable(dateOnlySchema)),
			deadlineTime: v.optional(v.nullable(timeOfDaySchema)),
			dailyWindow: v.optional(v.nullable(dailyWindowSchema)),
			access: v.optional(accessSchema),
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});

export const tagIdInputSchema = v.object({ tagId: idSchema });

/**
 * A tag's figures, narrowed the way its screen is; see `taskFilterSchema`. A
 * tag is its own filter, so there is no tag to pick.
 */
export const tagReadInputSchema = v.object({
	...tagIdInputSchema.entries,
	assignee: v.optional(emailSchema),
	type: v.optional(idSchema),
});
