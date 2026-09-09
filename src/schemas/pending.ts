import * as v from "valibot";
import {
	checklistIdInputSchema,
	createChecklistInputSchema,
	updateChecklistInputSchema,
} from "./checklist";
import {
	createTagInputSchema,
	deleteTagInputSchema,
	updateTagInputSchema,
} from "./tag";
import {
	createTaskInputSchema,
	deleteTaskInputSchema,
	updateTaskInputSchema,
} from "./task";
import {
	addTaskRefInputSchema,
	moveTaskRefInputSchema,
	removeTaskRefInputSchema,
} from "./task-list";
import {
	createProgressEntryInputSchema,
	createTrackerInputSchema,
	deleteProgressEntryInputSchema,
	trackerIdInputSchema,
	updateProgressEntryInputSchema,
	updateTrackerInputSchema,
} from "./tracker";

/**
 * One queued edit.
 *
 * Edits are collected in the browser and sent as a reviewed batch rather than
 * written one keystroke at a time, so nothing is saved until it has been looked
 * at. Each variant carries exactly the payload its server function already
 * takes, which is why the entries are spread from those schemas rather than
 * restated: the queue cannot drift from what the server accepts.
 *
 * Every id is chosen by the client. A change has to be shown in the right place
 * before it reaches the database, and a later change in the same batch has to
 * be able to refer to something an earlier one created.
 */
const pendingChangeSchema = v.variant("kind", [
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

	v.object({ kind: v.literal("ref.add"), ...addTaskRefInputSchema.entries }),
	v.object({
		kind: v.literal("ref.remove"),
		...removeTaskRefInputSchema.entries,
	}),
	v.object({ kind: v.literal("ref.move"), ...moveTaskRefInputSchema.entries }),

	v.object({ kind: v.literal("tag.create"), ...createTagInputSchema.entries }),
	v.object({ kind: v.literal("tag.update"), ...updateTagInputSchema.entries }),
	v.object({ kind: v.literal("tag.delete"), ...deleteTagInputSchema.entries }),
]);

export type PendingChange = v.InferOutput<typeof pendingChangeSchema>;

/**
 * A queued change as the browser holds it.
 *
 * `label` and `preview` are written when the change is queued, while the
 * surrounding screen still knows the titles involved. Keeping them here means
 * the review dialog can describe "Add Book flights to Today" without going back
 * to the database, and Today can draw a row for a task it has not fetched.
 *
 * Neither is ever sent to the server; only `change` is.
 */
export type QueuedChange = {
	id: string;
	queuedAt: string;
	label: string;
	/** Set on `ref.add`, whose task is not yet in the list being rendered. */
	preview?: {
		title: string;
		completed: boolean;
		checklistTitle: string;
		tagIds: Array<string>;
		urgent: boolean;
		important: boolean;
	};
	change: PendingChange;
};

/** How many changes one save writes. Anything beyond it saves on the next pass. */
export const MAX_BATCH_SIZE = 200;

export const applyChangesInputSchema = v.object({
	changes: v.pipe(
		v.array(pendingChangeSchema),
		v.maxLength(
			MAX_BATCH_SIZE,
			`Apply at most ${MAX_BATCH_SIZE} changes at a time.`,
		),
	),
});

/**
 * How far a batch got.
 *
 * The changes are replayed in order and stop at the first failure, so
 * `appliedCount` is always a prefix: the browser drops exactly what was written
 * and keeps the rest queued, instead of guessing and either losing edits or
 * applying them twice.
 */
export type ApplyResult = {
	appliedCount: number;
	/** Present when the batch stopped early. */
	failure: { index: number; message: string } | null;
};
