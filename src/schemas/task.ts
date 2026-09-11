import * as v from "valibot";
import { idSchema, tagIdsSchema, titleSchema } from "./common";

/**
 * A task exactly as it is stored.
 *
 * A task is a flat thing: a title, whether it is done, when it was added, its
 * tags, and the two flags below. Ordering comes from `addedAt` alone, so there
 * is no position to keep in step with anything else.
 */
const taskSchema = v.object({
	taskId: idSchema,
	title: titleSchema,
	completed: v.boolean(),
	/** ISO timestamp the task was added. The only thing tasks are ordered by. */
	addedAt: v.string(),
	/**
	 * ISO timestamp the task was ticked, or `null` while it is still open.
	 *
	 * Written by the server rather than the browser, so a chart drawn from these
	 * is not at the mercy of one machine's clock. Tasks completed before this
	 * existed have `null` and are counted as done from the start of their list —
	 * there is no honest way to invent a day for them.
	 */
	completedAt: v.optional(v.nullable(v.string()), null),
	/**
	 * Ids into the tags collection. Names live there so renaming is one write.
	 *
	 * The tags written in the title, plus every tag its checklist carries. The
	 * checklist's are stored on the task rather than looked up on each read, so
	 * a tag's page still finds all of its tasks with one query.
	 */
	tagIds: v.array(idSchema),
	/**
	 * The tracker this task stands for, or `null` for an ordinary task.
	 *
	 * "Read 30 more pages" is not a thing you tick — it is a thing that becomes
	 * true when the tracker reaches its target. So a task like this cannot be
	 * completed by hand: `completed` is worked out from the tracker every time
	 * the list is read, and the server refuses to set it directly. Otherwise the
	 * tick and the tracker could disagree, and then neither would mean anything.
	 */
	trackerId: v.optional(v.nullable(idSchema), null),
	/**
	 * The checklist this task stands for, or absent or `null` for an ordinary
	 * task.
	 *
	 * The same idea as `trackerId`: a task standing for a checklist is done when
	 * every task in that checklist is, so it is worked out on read and cannot be
	 * ticked by hand. A checklist can never end up inside itself, however deep
	 * the nesting — the server refuses the task that would do it.
	 */
	linkedChecklistId: v.optional(v.nullable(idSchema)),
	/**
	 * Needs doing soon, whether or not it matters much.
	 *
	 * Urgency and importance are kept apart rather than collapsed into one
	 * "priority" number because they are genuinely different questions, and the
	 * useful answer is which of the four corners a task sits in — the thing that
	 * is both is the thing to do next, and the thing that is only urgent is the
	 * one worth noticing you keep doing instead.
	 */
	urgent: v.optional(v.boolean(), false),
	/** Matters, whether or not it is pressing. */
	important: v.optional(v.boolean(), false),
	/**
	 * A line of detail drawn small under the title wherever the task is listed.
	 * Absent or empty means none.
	 *
	 * Like the notes, it is only ever written from the edit dialog: adding a task
	 * is one line of typing, and a second field there would slow down the thing
	 * that has to stay quick.
	 */
	caption: v.optional(v.string()),
	/**
	 * Longer notes, in Markdown. Absent or empty means none.
	 *
	 * Shown only in the edit dialog, never on a row: a list is for scanning, and
	 * notes are the part of a task nobody scans.
	 */
	notes: v.optional(v.string()),
});

export type Task = v.InferOutput<typeof taskSchema>;

/** Where a task sits in the urgent/important grid, best first. */
export const PRIORITY_RANKS = [
	"urgent-important",
	"urgent",
	"important",
	"none",
] as const;

export type PriorityRank = (typeof PRIORITY_RANKS)[number];

export const PRIORITY_LABELS: Record<PriorityRank, string> = {
	"urgent-important": "Urgent and important",
	urgent: "Urgent",
	important: "Important",
	none: "Everything else",
};

export function priorityRank(
	task: Pick<Task, "urgent" | "important">,
): PriorityRank {
	if (task.urgent && task.important) return "urgent-important";
	if (task.urgent) return "urgent";
	if (task.important) return "important";
	return "none";
}

/**
 * Adding a task is meant to be quick, so the only thing required is a title.
 * The id and the timestamp are decided by the client, because a queued task
 * has to appear in the right place before it ever reaches the database.
 */
export const createTaskInputSchema = v.object({
	/**
	 * The checklist it belongs to, or `null` for a task that belongs to none.
	 *
	 * A task jotted straight onto a tag's page — Today's, usually — is not part
	 * of any list of work; it is just a thing to do, and inventing a checklist to
	 * hold it only puts a checklist nobody asked for on the Checklists screen.
	 */
	checklistId: v.nullable(idSchema),
	taskId: idSchema,
	title: titleSchema,
	addedAt: v.string(),
	tagIds: v.optional(tagIdsSchema, []),
	/** A tracker this task stands for; see `taskSchema`. */
	trackerId: v.optional(v.nullable(idSchema), null),
	/** A checklist this task stands for; see `taskSchema`. */
	linkedChecklistId: v.optional(v.nullable(idSchema), null),
	urgent: v.optional(v.boolean(), false),
	important: v.optional(v.boolean(), false),
});

/**
 * A partial edit. Every field is optional, but at least one must be present so
 * a no-op edit does not cost a database round trip.
 */
const taskPatchSchema = v.pipe(
	v.object({
		title: v.optional(titleSchema),
		completed: v.optional(v.boolean()),
		tagIds: v.optional(tagIdsSchema),
		urgent: v.optional(v.boolean()),
		important: v.optional(v.boolean()),
		// No upper limit on either, for the same reason a title has none.
		caption: v.optional(v.pipe(v.string(), v.trim())),
		notes: v.optional(v.pipe(v.string(), v.trim())),
	}),
	v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
);

export type TaskPatch = v.InferOutput<typeof taskPatchSchema>;

export const updateTaskInputSchema = v.object({
	taskId: idSchema,
	patch: taskPatchSchema,
});

export const deleteTaskInputSchema = v.object({ taskId: idSchema });
