import * as v from "valibot";
import type { ChecklistProgress, PaceStatus } from "./checklist";
import {
	dateOnlySchema,
	descriptionSchema,
	idSchema,
	todayDateOnly,
} from "./common";
import type { Task } from "./task";

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
	description: v.string(),
	/** The day the work started, or `null` to count from the day it was made. */
	startDate: v.nullable(dateOnlySchema),
	/** The day it should be finished by. Without one there is no pace. */
	deadline: v.nullable(dateOnlySchema),
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

export type TagSummary = Tag & {
	progress: ChecklistProgress;
	status: PaceStatus | null;
};

/** A task carrying a tag, with the checklist it lives in, if any. */
export type TagTaskEntry = {
	task: Task;
	/** `null` for a task that belongs to no checklist. */
	checklistId: string | null;
	checklistTitle: string | null;
};

export type TagDetail = TagSummary & {
	tasks: Array<TagTaskEntry>;
};

export const createTagInputSchema = v.object({
	tagId: idSchema,
	name: tagNameSchema,
	color: tagColorSchema,
	description: v.optional(descriptionSchema, ""),
	startDate: v.optional(v.nullable(dateOnlySchema), null),
	deadline: v.optional(v.nullable(dateOnlySchema), null),
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
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});

export const tagIdInputSchema = v.object({ tagId: idSchema });
