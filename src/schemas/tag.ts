import * as v from "valibot";
import { idSchema } from "./common";

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
 */
const tagSchema = v.object({
	tagId: idSchema,
	name: tagNameSchema,
	color: tagColorSchema,
	createdAt: v.string(),
	updatedAt: v.string(),
});

export type Tag = v.InferOutput<typeof tagSchema>;

export const createTagInputSchema = v.object({
	tagId: idSchema,
	name: tagNameSchema,
	color: tagColorSchema,
});

export const updateTagInputSchema = v.object({
	tagId: idSchema,
	patch: v.pipe(
		v.object({
			name: v.optional(tagNameSchema),
			color: v.optional(tagColorSchema),
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});

export const deleteTagInputSchema = v.object({ tagId: idSchema });
