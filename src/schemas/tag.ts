import * as v from "valibot";
import type { ChecklistProgress } from "./checklist";
import {
	dailyWindowSchema,
	dateOnlySchema,
	descriptionSchema,
	idSchema,
	timeOfDaySchema,
	todayDateOnly,
} from "./common";
import type { Task } from "./task";
import type { TrackerSummary } from "./tracker";

/**
 * Tag colours are the Astryx `Token` palette, so a tag renders the same
 * everywhere without a lookup table of hex values.
 */
export const TAG_COLORS = [
	"blue",
	"purple",
	"pink",
	"red",
	"orange",
	"yellow",
	"green",
	"teal",
	"cyan",
	"gray",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

const tagColorSchema = v.picklist(TAG_COLORS);

/**
 * The two tags every account has and cannot lose: what you are doing today,
 * and what you have parked.
 *
 * They are tags in every other way — a name and a colour, both changeable on
 * the Tags screen — but the row's bolt writes the first into a task's title and
 * its menu writes the second, so both have to exist and neither can be
 * deleted. Each is known by its kind rather than its name, because the name is
 * the user's to change.
 */
export const SPECIAL_TAGS = ["today", "backlog"] as const;

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

/** A tag with its progress; its pace is judged in the browser, see `usePace`. */
export type TagSummary = Tag & {
	progress: ChecklistProgress;
};

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
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});

export const tagIdInputSchema = v.object({ tagId: idSchema });
