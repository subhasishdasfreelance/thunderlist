import * as v from "valibot";
import { idSchema, titleSchema } from "./common";

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
	/** Ids into the tags collection. Names live there so renaming is one write. */
	tagIds: v.array(idSchema),
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
	checklistId: idSchema,
	taskId: idSchema,
	title: titleSchema,
	addedAt: v.string(),
	tagIds: v.optional(tagIdsSchema, []),
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
	}),
	v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
);

export type TaskPatch = v.InferOutput<typeof taskPatchSchema>;

export const updateTaskInputSchema = v.object({
	checklistId: idSchema,
	taskId: idSchema,
	patch: taskPatchSchema,
});

export const deleteTaskInputSchema = v.object({
	checklistId: idSchema,
	taskId: idSchema,
});
