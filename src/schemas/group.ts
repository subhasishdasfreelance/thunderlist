import * as v from "valibot";
import { idSchema } from "./common";
import { TAG_COLORS, type TagColor } from "./tag";

/**
 * A group: a named collection of checklists, trackers and tags, mixed freely —
 * "Launch" holding the launch checklist, the signups tracker and #marketing.
 *
 * It holds nothing but which things belong. Deleting a group never deletes
 * what is in it, and a thing can be in any number of groups. The space keeps
 * its groups in its settings, so a team sees the same ones.
 *
 * An item naming something since deleted, or kept from whoever is looking, is
 * skipped when the group is drawn and kept when it is written, so nobody's
 * editing loses an item they cannot see.
 */

export const GROUP_ITEM_KINDS = ["checklist", "tracker", "tag"] as const;

export type GroupItemKind = (typeof GROUP_ITEM_KINDS)[number];

const groupItemSchema = v.object({
	kind: v.picklist(GROUP_ITEM_KINDS),
	id: idSchema,
});

export type GroupItem = v.InferOutput<typeof groupItemSchema>;

const groupNameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "Every group needs a name"),
	v.maxLength(40, "Group names must be 40 characters or fewer"),
);

const groupItemsSchema = v.pipe(
	v.array(groupItemSchema),
	v.maxLength(500, "At most 500 things in a group"),
);

export type Group = {
	groupId: string;
	/** `G-1`, for people; absent until the server hands it one. See `NUMBER_PREFIXES`. */
	number?: number;
	name: string;
	color: TagColor;
	items: Array<GroupItem>;
	createdAt: string;
	updatedAt: string;
};

/** Whether two items name the same thing. */
export function sameItem(a: GroupItem, b: GroupItem): boolean {
	return a.kind === b.kind && a.id === b.id;
}

export const groupIdInputSchema = v.object({ groupId: idSchema });

export const createGroupInputSchema = v.object({
	groupId: idSchema,
	name: groupNameSchema,
	color: v.picklist(TAG_COLORS),
	items: groupItemsSchema,
});

export const updateGroupInputSchema = v.object({
	groupId: idSchema,
	patch: v.pipe(
		v.object({
			name: v.optional(groupNameSchema),
			color: v.optional(v.picklist(TAG_COLORS)),
			items: v.optional(groupItemsSchema),
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});
