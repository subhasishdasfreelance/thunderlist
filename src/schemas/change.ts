import * as v from "valibot";
import {
	checklistIdInputSchema,
	createChecklistInputSchema,
	updateChecklistInputSchema,
} from "./checklist";
import {
	createTagInputSchema,
	tagIdInputSchema,
	updateTagInputSchema,
} from "./tag";
import {
	createTaskInputSchema,
	deleteTaskInputSchema,
	updateTaskInputSchema,
} from "./task";
import {
	createProgressEntryInputSchema,
	createTrackerInputSchema,
	deleteProgressEntryInputSchema,
	trackerIdInputSchema,
	updateProgressEntryInputSchema,
	updateTrackerInputSchema,
} from "./tracker";

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
		kind: v.literal("task.update"),
		...updateTaskInputSchema.entries,
	}),
	v.object({
		kind: v.literal("task.delete"),
		...deleteTaskInputSchema.entries,
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

	v.object({ kind: v.literal("tag.create"), ...createTagInputSchema.entries }),
	v.object({ kind: v.literal("tag.update"), ...updateTagInputSchema.entries }),
	v.object({ kind: v.literal("tag.delete"), ...tagIdInputSchema.entries }),
]);

export type Change = v.InferOutput<typeof changeSchema>;

export const applyChangeInputSchema = v.object({ change: changeSchema });
