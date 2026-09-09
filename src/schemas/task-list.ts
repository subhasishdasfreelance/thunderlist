import * as v from "valibot";
import { directionSchema, idSchema, sortOrderSchema } from "./common";
import type { Task } from "./task";

/**
 * The two reference lists: what you plan to do today, and what you have parked.
 *
 * Both are the same shape and both hold *references only*. Completion lives on
 * the canonical task in its checklist, so there is exactly one source
 * of truth for it. A task belongs to at most one of these lists.
 */
export const TASK_LIST_NAMES = ["today", "backlog"] as const;

export type TaskListName = (typeof TASK_LIST_NAMES)[number];

const taskListNameSchema = v.picklist(TASK_LIST_NAMES);

export const TASK_LIST_LABELS: Record<TaskListName, string> = {
	today: "Today",
	backlog: "Backlog",
};

/**
 * The gap between neighbouring `sortOrder` values.
 *
 * Reference lists are ordered by hand, so they keep an explicit position.
 * Stepping by 10 leaves room to drop something between two entries without
 * renumbering the list.
 */
export const SORT_ORDER_STEP = 10;

/** One entry on the Today or Backlog list. */
const taskRefSchema = v.object({
	itemId: idSchema,
	checklistId: idSchema,
	taskId: idSchema,
	sortOrder: sortOrderSchema,
	addedAt: v.string(),
});

export type TaskRef = v.InferOutput<typeof taskRefSchema>;

/**
 * A resolved reference. `task` is `null` when it is stale — the checklist or
 * task was deleted. The UI surfaces these so
 * the user can clear them rather than hiding the problem.
 */
export type TaskRefEntry = {
	item: TaskRef;
	list: TaskListName;
	checklistTitle: string | null;
	task: Task | null;
};

export const addTaskRefInputSchema = v.object({
	list: taskListNameSchema,
	itemId: idSchema,
	checklistId: idSchema,
	taskId: idSchema,
	sortOrder: sortOrderSchema,
});

export const removeTaskRefInputSchema = v.object({
	list: taskListNameSchema,
	itemId: idSchema,
});

export const moveTaskRefInputSchema = v.object({
	list: taskListNameSchema,
	itemId: idSchema,
	direction: directionSchema,
});
