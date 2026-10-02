import * as v from "valibot";
import { accessSchema } from "./access";
import { arrangementInputSchema } from "./arrangement";
import {
	checklistIdInputSchema,
	createChecklistInputSchema,
	updateChecklistInputSchema,
} from "./checklist";
import { idSchema } from "./common";
import {
	countdownIdInputSchema,
	createCountdownInputSchema,
	updateCountdownInputSchema,
} from "./countdown";
import {
	createGroupInputSchema,
	groupIdInputSchema,
	importGroupInputSchema,
	updateGroupInputSchema,
} from "./group";
import {
	createPlanInputSchema,
	planIdInputSchema,
	updatePlanInputSchema,
} from "./plan";
import {
	createTagInputSchema,
	tagIdInputSchema,
	updateTagInputSchema,
} from "./tag";
import {
	createTaskInputSchema,
	createTasksInputSchema,
	deleteTaskInputSchema,
	deleteTasksInputSchema,
	MAX_TASKS_AT_ONCE,
	moveTaskInputSchema,
	updateTaskInputSchema,
} from "./task";
import { taskTypesInputSchema } from "./task-type";
import {
	createProgressEntryInputSchema,
	createTrackerInputSchema,
	deleteProgressEntriesInputSchema,
	deleteProgressEntryInputSchema,
	trackerIdInputSchema,
	updateProgressEntryInputSchema,
	updateTrackerInputSchema,
} from "./tracker";

const taskUpdateSchema = v.object({
	kind: v.literal("task.update"),
	...updateTaskInputSchema.entries,
});

const taskMoveSchema = v.object({
	kind: v.literal("task.move"),
	...moveTaskInputSchema.entries,
});

/** What can be picked out on its screen and deleted together; see `PickBar`. */
export const PICKABLE_KINDS = [
	"checklist",
	"tracker",
	"tag",
	"plan",
	"countdown",
] as const;

export type PickableKind = (typeof PICKABLE_KINDS)[number];

/** Of those, what has an access list, to be shared together. */
export const SHAREABLE_KINDS = ["checklist", "tracker", "tag"] as const;

export type ShareableKind = (typeof SHAREABLE_KINDS)[number];

const pickedIdsSchema = v.pipe(
	v.array(idSchema),
	v.minLength(1, "Pick at least one"),
	v.maxLength(500, "Too many at once"),
);

/**
 * One change to the data, as the browser asks for it.
 *
 * Every mutation in the app is one of these and goes straight to the database.
 * Each variant carries exactly the payload its repository already takes, which
 * is why the entries are spread from those schemas rather than restated: the
 * command cannot drift from what the server accepts.
 *
 * Ids are still minted in the browser. That keeps a change replayable — asking
 * twice for the same task is the same task, not two — which is what makes a
 * retry after a dropped connection safe.
 */
const changeSchema = v.variant("kind", [
	v.object({
		kind: v.literal("checklist.create"),
		...createChecklistInputSchema.entries,
	}),
	v.object({
		kind: v.literal("checklist.update"),
		...updateChecklistInputSchema.entries,
	}),
	v.object({
		kind: v.literal("checklist.delete"),
		...checklistIdInputSchema.entries,
	}),

	v.object({
		kind: v.literal("task.create"),
		...createTaskInputSchema.entries,
	}),
	v.object({
		kind: v.literal("task.createMany"),
		...createTasksInputSchema.entries,
	}),
	taskUpdateSchema,
	v.object({
		kind: v.literal("task.delete"),
		...deleteTaskInputSchema.entries,
	}),
	v.object({
		kind: v.literal("task.deleteMany"),
		...deleteTasksInputSchema.entries,
	}),
	taskMoveSchema,
	/**
	 * Edits and moves to many tasks at once — every task picked out — sent as
	 * one request rather than one a task; see `applyChange`. Two a task at
	 * most: parking one is an edit and then a move; see `moveToBacklog`.
	 */
	v.object({
		kind: v.literal("task.batch"),
		changes: v.pipe(
			v.array(v.variant("kind", [taskUpdateSchema, taskMoveSchema])),
			v.minLength(1, "Pick at least one task"),
			v.maxLength(2 * MAX_TASKS_AT_ONCE, "Too many tasks at once"),
		),
	}),

	v.object({
		kind: v.literal("tracker.create"),
		...createTrackerInputSchema.entries,
	}),
	v.object({
		kind: v.literal("tracker.update"),
		...updateTrackerInputSchema.entries,
	}),
	v.object({
		kind: v.literal("tracker.delete"),
		...trackerIdInputSchema.entries,
	}),

	v.object({
		kind: v.literal("entry.create"),
		...createProgressEntryInputSchema.entries,
	}),
	v.object({
		kind: v.literal("entry.update"),
		...updateProgressEntryInputSchema.entries,
	}),
	v.object({
		kind: v.literal("entry.delete"),
		...deleteProgressEntryInputSchema.entries,
	}),
	v.object({
		kind: v.literal("entry.deleteMany"),
		...deleteProgressEntriesInputSchema.entries,
	}),

	v.object({ kind: v.literal("tag.create"), ...createTagInputSchema.entries }),
	v.object({ kind: v.literal("tag.update"), ...updateTagInputSchema.entries }),
	v.object({ kind: v.literal("tag.delete"), ...tagIdInputSchema.entries }),

	v.object({
		kind: v.literal("taskTypes.set"),
		...taskTypesInputSchema.entries,
	}),

	v.object({
		kind: v.literal("arrangement.set"),
		...arrangementInputSchema.entries,
	}),

	v.object({
		kind: v.literal("group.create"),
		...createGroupInputSchema.entries,
	}),
	v.object({
		kind: v.literal("group.update"),
		...updateGroupInputSchema.entries,
	}),
	v.object({ kind: v.literal("group.delete"), ...groupIdInputSchema.entries }),
	/** A group and its checklists, made from a pasted outline; see `parseOutline`. */
	v.object({
		kind: v.literal("group.import"),
		...importGroupInputSchema.entries,
	}),

	v.object({
		kind: v.literal("plan.create"),
		...createPlanInputSchema.entries,
	}),
	v.object({
		kind: v.literal("plan.update"),
		...updatePlanInputSchema.entries,
	}),
	v.object({ kind: v.literal("plan.delete"), ...planIdInputSchema.entries }),

	v.object({
		kind: v.literal("countdown.create"),
		...createCountdownInputSchema.entries,
	}),
	v.object({
		kind: v.literal("countdown.update"),
		...updateCountdownInputSchema.entries,
	}),
	v.object({
		kind: v.literal("countdown.delete"),
		...countdownIdInputSchema.entries,
	}),

	/**
	 * Several checklists, trackers, tags, plans or countdowns picked out on
	 * their screen, deleted in one request; see `deleteItems`.
	 */
	v.object({
		kind: v.literal("items.delete"),
		of: v.picklist(PICKABLE_KINDS),
		ids: pickedIdsSchema,
	}),
	/** Several of them given one access list; see `shareItems`. */
	v.object({
		kind: v.literal("items.share"),
		of: v.picklist(SHAREABLE_KINDS),
		ids: pickedIdsSchema,
		access: accessSchema,
	}),
]);

export type Change = v.InferOutput<typeof changeSchema>;

/** A change that can go in a `task.batch`. */
export type BatchedChange = Extract<
	Change,
	{ kind: "task.update" | "task.move" }
>;

export function isBatchable(change: Change): change is BatchedChange {
	return change.kind === "task.update" || change.kind === "task.move";
}

export const applyChangeInputSchema = v.object({ change: changeSchema });
