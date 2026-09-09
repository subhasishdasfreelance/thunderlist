import * as v from "valibot";
import { idSchema, sortOrderSchema, titleSchema } from "./common";
import { TASK_LIST_NAMES } from "./task-list";

/** Tag ids carried by a task. Order is the order the user applied them in. */
const tagIdsSchema = v.pipe(
	v.array(idSchema),
	v.maxLength(20, "A task can carry at most 20 tags"),
);

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
	/** Ids into the tags collection. Names live there so renaming is one write. */
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
	 * A task jotted straight onto Today is not part of any list of work — it is
	 * just a thing to do — and inventing a checklist to hold it only puts a
	 * checklist nobody asked for on the Checklists screen.
	 */
	checklistId: v.nullable(idSchema),
	taskId: idSchema,
	title: titleSchema,
	addedAt: v.string(),
	tagIds: v.optional(tagIdsSchema, []),
	/** A tracker this task stands for; see `taskSchema`. */
	trackerId: v.optional(v.nullable(idSchema), null),
	urgent: v.optional(v.boolean(), false),
	important: v.optional(v.boolean(), false),
	/**
	 * Put it straight on a list, in the same breath as creating it.
	 *
	 * A task typed into Today is one act, and it used to be two changes — create,
	 * then reference — fired together without waiting. They raced: the reference
	 * could arrive first, find no such task, and be refused, so the task existed
	 * but never appeared on the list. Ordering two independent requests is not
	 * something a caller can be relied on to remember, so the dependency is
	 * expressed here instead and settled in one write on the server.
	 */
	place: v.optional(
		v.nullable(
			v.object({
				list: v.picklist(TASK_LIST_NAMES),
				itemId: idSchema,
				sortOrder: sortOrderSchema,
			}),
		),
		null,
	),
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
	}),
	v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
);

export type TaskPatch = v.InferOutput<typeof taskPatchSchema>;

export const updateTaskInputSchema = v.object({
	taskId: idSchema,
	patch: taskPatchSchema,
});

export const deleteTaskInputSchema = v.object({ taskId: idSchema });
