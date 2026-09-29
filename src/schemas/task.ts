import * as v from "valibot";
import {
	assigneesSchema,
	dateOnlySchema,
	emailSchema,
	idSchema,
	itemRefSchema,
	tagIdsSchema,
	timeOfDaySchema,
	titleSchema,
} from "./common";

/**
 * A task exactly as it is stored.
 *
 * A task is a flat thing: a title, whether it is done, when it was added, its
 * tags, and the two flags below. Ordering comes from `addedAt` alone, so there
 * is no position to keep in step with anything else.
 */
const taskSchema = v.object({
	taskId: idSchema,
	/** `T-42`, for people; absent until the server hands it one. See `NUMBER_PREFIXES`. */
	number: v.optional(v.number()),
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
	/**
	 * Who in its team it is assigned to, by address. Absent or empty for
	 * nobody — which is every task outside a team.
	 */
	assignees: v.optional(v.array(v.string())),
	/**
	 * Which of its checklist's stages it is at; see `Checklist.stages`. Absent
	 * on tasks from before stages, which are at the first stage while open and
	 * the last once done. Always filled in on the way out; see `stageOf`.
	 */
	stageId: v.optional(v.nullable(idSchema)),
	/** What kind of work it is — a bug, a feature; see `TaskType`. Optional. */
	typeId: v.optional(v.nullable(idSchema)),
	/**
	 * What has to be done before this can be: other tasks, checklists,
	 * trackers or tags, from anywhere. Absent or empty for nothing.
	 *
	 * A task is done once ticked; a checklist or a tag once it has tasks and
	 * every one is done; a tracker once it reaches its target. Until each is,
	 * this task cannot be completed. Deleting any of them takes it off here.
	 */
	dependsOn: v.optional(v.array(itemRefSchema)),
});

export type Task = v.InferOutput<typeof taskSchema>;

/** What a task waits on, as an edit sends it; see `Task.dependsOn`. */
const dependsOnSchema = v.pipe(
	v.array(itemRefSchema),
	v.maxLength(50, "A task can wait on at most 50 things"),
);

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

/** The orders a list of tasks can be shown in; see `sortTasksBy`. */
export const SORT_ORDERS = ["newest", "priority", "stage", "type"] as const;

/**
 * What a task with no type is called wherever one is picked or filtered by.
 *
 * "No type" is a choice like any other — it is what most tasks are — so it
 * needs a value to be chosen by, and a task's own `typeId` is `null`. One
 * word, here, rather than a different one in each picker.
 */
export const NO_TYPE = "none";

/**
 * What a screen narrows its tasks to: one person's, in a team, one tag's, and
 * one kind of work's. Everything on the screen follows it — the list, the
 * counts and the progress — so the figures always describe the rows under them.
 */
export const taskFilterSchema = v.object({
	/** In a team, only the tasks assigned to this person. */
	assignee: v.optional(emailSchema),
	/**
	 * Only the tasks carrying this tag, by id. Not `tagId`: a tag's own page is
	 * addressed by that, and a filter must never be mistaken for the page.
	 */
	tag: v.optional(idSchema),
	/** Only the tasks of this kind, by id — or `NO_TYPE` for those with none. */
	type: v.optional(idSchema),
	/**
	 * Only the tasks standing for this tracker, by id: whether a tracker is on
	 * Today is whether Today has one; see its page.
	 */
	tracker: v.optional(idSchema),
});

export type TaskFilter = v.InferOutput<typeof taskFilterSchema>;

/**
 * Which page of a list to read: `limit` rows a page, numbered from 1, in one
 * order. With no page asked for it is the one holding `reveal` — the task a
 * `?task=` link names, which has to be on screen to be scrolled to — or the
 * first.
 *
 * On a checklist it is the page of one stage; with no stage asked for, the
 * stage `reveal` is at, or the first.
 */
export const taskPageSchema = v.object({
	sort: v.picklist(SORT_ORDERS),
	limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10_000)),
	page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
	reveal: v.optional(idSchema),
	stageId: v.optional(idSchema),
	/**
	 * On a tag, only the open tasks at the stage of this name, lowercased — or
	 * `NOT_STARTED_STAGE_KEY` for those not yet under way; see `tagStageKey`.
	 * Only the list: a finished task is at no stage, so the figures over it
	 * stay whole.
	 */
	stageName: v.optional(v.pipe(v.string(), v.maxLength(30))),
	...taskFilterSchema.entries,
});

export type TaskPageView = v.InferOutput<typeof taskPageSchema>;

/**
 * How every task is cut into groups: by stage or by type on the Across lists
 * screen, and into the four corners of urgent and important on the Priority
 * screen, which leaves finished work out; see `priorityRank`.
 */
const GROUP_BYS = ["stage", "type", "priority"] as const;

export type GroupBy = (typeof GROUP_BYS)[number];

/**
 * Which page of which group the Across lists or Priority screen is showing.
 *
 * `group` is not an id: cut by stage a group is a stage *name*, lowercased,
 * since that is what checklists share; cut by type it is a type's id, or the
 * word for the tasks with none; by priority it is a `PriorityRank`. With none
 * asked for it is the first group of whichever cut is shown.
 */
export const acrossPageSchema = v.object({
	groupBy: v.picklist(GROUP_BYS),
	group: v.optional(v.pipe(v.string(), v.maxLength(120))),
	...taskPageSchema.entries,
});

export type AcrossPageView = v.InferOutput<typeof acrossPageSchema>;

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
	/**
	 * The number it had, for a deleted task put back by an undo; taken only
	 * while no other task has it. A new task is given the next one.
	 */
	number: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
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
		assignees: v.optional(assigneesSchema),
		/** Moving it along its checklist's stages; see `Checklist.stages`. */
		stageId: v.optional(idSchema),
		typeId: v.optional(v.nullable(idSchema)),
		dependsOn: v.optional(dependsOnSchema),
		/**
		 * When it was finished, and where it sits in its list, as they were —
		 * for an undo putting a task back. Otherwise the server stamps both
		 * afresh as a task is ticked or moved on; see `updateTask`.
		 */
		completedAt: v.optional(v.nullable(v.pipe(v.string(), v.isoTimestamp()))),
		addedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
	}),
	v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
);

export type TaskPatch = v.InferOutput<typeof taskPatchSchema>;

export const updateTaskInputSchema = v.object({
	taskId: idSchema,
	patch: taskPatchSchema,
});

export const deleteTaskInputSchema = v.object({ taskId: idSchema });

/**
 * Deleting many tasks in one request: every finished task in a list, say.
 * As many as a list can hold, since "all" is what was asked for.
 */
export const deleteTasksInputSchema = v.object({
	taskIds: v.pipe(
		v.array(idSchema),
		v.minLength(1, "Pick at least one task"),
		v.maxLength(10_000, "Too many tasks at once"),
	),
});

/** Moving a task into another checklist; see `moveTask`. */
export const moveTaskInputSchema = v.object({
	taskId: idSchema,
	checklistId: idSchema,
	/**
	 * When it was moved, on the mover's own clock, which the server does not
	 * know; written into its notes, see `notesAfterMove`. Stamped on the way
	 * out, see `useApplyChange`.
	 */
	at: v.optional(v.object({ date: dateOnlySchema, time: timeOfDaySchema })),
});
