import * as v from "valibot";
import { stagesSchema } from "./checklist";
import {
	dateOnlySchema,
	descriptionSchema,
	idSchema,
	timeOfDaySchema,
	titleSchema,
	todayDateOnly,
} from "./common";
import { TAG_COLORS, type TagColor } from "./tag";
import { createTaskInputSchema, MAX_TASKS_AT_ONCE } from "./task";

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

export const MAX_GROUP_NAME = 120;

const groupNameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "Every group needs a name"),
	v.maxLength(
		MAX_GROUP_NAME,
		`Group names must be ${MAX_GROUP_NAME} characters or fewer`,
	),
);

export const MAX_GROUP_ITEMS = 500;

const groupItemsSchema = v.pipe(
	v.array(groupItemSchema),
	v.maxLength(MAX_GROUP_ITEMS, "At most 500 things in a group"),
);

export type Group = {
	groupId: string;
	/** `G-1`, for people; absent until the server hands it one. See `NUMBER_PREFIXES`. */
	number?: number;
	name: string;
	color: TagColor;
	items: Array<GroupItem>;
	/**
	 * Ids of what it holds, in the order picked by hand on its page; absent
	 * until it is arranged. Kept apart from `items`, which stay in the order
	 * they were added, so "Newest first" still reads from them. See
	 * `manualOrder`.
	 */
	order?: Array<string>;
	/**
	 * The day its pace is measured from; absent on a group made before groups
	 * had a schedule, which is paced from the day it was made. See
	 * `groupStartDate`.
	 */
	startDate?: string;
	/** The day everything in it should be done by; absent or `null` for none. */
	deadline?: string | null;
	/** `HH:MM` on the deadline day; absent or `null` for that day's start. */
	deadlineTime?: string | null;
	createdAt: string;
	updatedAt: string;
};

/** The day a group's figures are measured from; see `Group.startDate`. */
export function groupStartDate(
	group: Pick<Group, "startDate" | "createdAt">,
): string {
	return group.startDate ?? todayDateOnly(new Date(group.createdAt));
}

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
	startDate: dateOnlySchema,
	deadline: v.optional(v.nullable(dateOnlySchema), null),
	deadlineTime: v.optional(v.nullable(timeOfDaySchema), null),
});

export const updateGroupInputSchema = v.object({
	groupId: idSchema,
	patch: v.pipe(
		v.object({
			name: v.optional(groupNameSchema),
			color: v.optional(v.picklist(TAG_COLORS)),
			items: v.optional(groupItemsSchema),
			order: v.optional(
				v.pipe(
					v.array(idSchema),
					v.maxLength(MAX_GROUP_ITEMS, "At most 500 things in a group"),
				),
			),
			startDate: v.optional(dateOnlySchema),
			deadline: v.optional(v.nullable(dateOnlySchema)),
			deadlineTime: v.optional(v.nullable(timeOfDaySchema)),
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});

/** The checklists a pasted outline makes, each with its tasks; see `parseOutline`. */
const outlineChecklistsSchema = v.pipe(
	v.array(
		v.object({
			checklistId: idSchema,
			title: titleSchema,
			description: descriptionSchema,
			/** Read off its heading; see `parseChecklistTitle`. */
			urgent: v.optional(v.boolean()),
			important: v.optional(v.boolean()),
			stages: v.optional(stagesSchema),
			deadline: v.optional(dateOnlySchema),
			deadlineTime: v.optional(timeOfDaySchema),
			tasks: v.array(
				v.pick(createTaskInputSchema, [
					"taskId",
					"title",
					"addedAt",
					"tagIds",
					"urgent",
					"important",
				]),
			),
		}),
	),
	v.minLength(1, "Start a checklist with a # heading"),
	v.maxLength(MAX_GROUP_ITEMS, "At most 500 checklists in a group"),
	v.check(
		(checklists) =>
			checklists.reduce((sum, each) => sum + each.tasks.length, 0) <=
			MAX_TASKS_AT_ONCE,
		"Too many tasks at once",
	),
);

/**
 * A group made from a pasted outline: a new checklist for each heading, each
 * with its tasks, and the group holding them all — written in one request.
 * See `parseOutline`.
 */
export const importGroupInputSchema = v.object({
	groupId: idSchema,
	name: groupNameSchema,
	color: v.picklist(TAG_COLORS),
	/** Every checklist starts on this day; see `Checklist.startDate`. */
	startDate: dateOnlySchema,
	checklists: outlineChecklistsSchema,
});

/**
 * A pasted outline added to a group that exists: its checklists made, as
 * `importGroupInputSchema` makes them, and put after what the group holds.
 */
export const importIntoGroupInputSchema = v.object({
	groupId: idSchema,
	/** Every checklist starts on this day; see `Checklist.startDate`. */
	startDate: dateOnlySchema,
	checklists: outlineChecklistsSchema,
});

export type ImportGroupInput = v.InferOutput<typeof importGroupInputSchema>;

/** What a group made from an outline holds: the checklists it made. */
export function importedItems(
	checklists: ReadonlyArray<{ checklistId: string }>,
): Array<GroupItem> {
	return checklists.map((each) => ({
		kind: "checklist",
		id: each.checklistId,
	}));
}
