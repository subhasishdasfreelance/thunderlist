import * as v from "valibot";
import {
	dailyWindowSchema,
	dateOnlySchema,
	descriptionSchema,
	idSchema,
	tagIdsSchema,
	timeOfDaySchema,
	titleSchema,
	visibleToSchema,
} from "./common";
import { taskFilterSchema } from "./task";

const PACE_STATUSES = ["ahead", "on_track", "behind"] as const;

const stageNameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "Every stage needs a name"),
	v.maxLength(30, "Stage names must be 30 characters or fewer"),
);

const stageSchema = v.object({ stageId: idSchema, name: stageNameSchema });

/**
 * One step a task goes through in a checklist: "To do", "Review", "Done".
 * The id stays put through a rename, so tasks keep their place.
 */
export type Stage = v.InferOutput<typeof stageSchema>;

/**
 * The steps a checklist's tasks go through, in order.
 *
 * The last stage is done: a task reaching it is complete, and ticking a task
 * moves it there. Every other stage is work still open. Two is the least —
 * something to do and it being done — which is what every checklist has until
 * it is given more.
 */
export const stagesSchema = v.pipe(
	v.array(stageSchema),
	v.minLength(2, "A checklist needs at least two stages"),
	v.maxLength(12, "At most 12 stages"),
	v.check(
		(stages) =>
			new Set(stages.map((stage) => stage.name.toLowerCase())).size ===
			stages.length,
		"Two stages can't share a name",
	),
	v.check(
		(stages) =>
			new Set(stages.map((stage) => stage.stageId)).size === stages.length,
		"Two stages can't share an id",
	),
);

/** What a checklist has until it is given stages of its own. */
export const DEFAULT_STAGES: ReadonlyArray<Stage> = [
	{ stageId: "todo", name: "To do" },
	{ stageId: "done", name: "Done" },
];

export function checklistStages(checklist: {
	stages?: ReadonlyArray<Stage>;
}): ReadonlyArray<Stage> {
	const stages = checklist.stages ?? [];
	return stages.length >= 2 ? stages : DEFAULT_STAGES;
}

/**
 * The stage a task is at: the one it names, while its checklist still has it;
 * otherwise the first while it is open and the last once it is done — where a
 * task from before stages, or from a stage since removed, belongs.
 */
export function stageOf(
	task: { stageId?: string | null; completed: boolean },
	stages: ReadonlyArray<Stage>,
): string {
	const last = stages[stages.length - 1].stageId;
	if (task.completed) return last;

	const named = stages.find((stage) => stage.stageId === task.stageId);
	return named === undefined || named.stageId === last
		? stages[0].stageId
		: named.stageId;
}

/**
 * A pace judgement. Only ever produced when there is enough information to
 * calculate one (a deadline after the start date) — never invented.
 */
export type PaceStatus = (typeof PACE_STATUSES)[number];

export const PACE_STATUS_LABELS: Record<PaceStatus, string> = {
	ahead: "Ahead",
	on_track: "On track",
	behind: "Behind",
};

const checklistSchema = v.object({
	checklistId: idSchema,
	title: titleSchema,
	description: v.string(),
	/**
	 * The day the work started. Defaults to today when created, but can be set
	 * back so a checklist begun earlier is paced from when it really began.
	 */
	startDate: dateOnlySchema,
	/** The day it should be finished by. Without one there is no pace. */
	deadline: v.nullable(dateOnlySchema),
	/**
	 * The time on the deadline day it is due by. Absent or `null` means the
	 * start of that day, which is what a deadline meant before it had a time.
	 */
	deadlineTime: v.optional(v.nullable(timeOfDaySchema)),
	/**
	 * The hours of every day it is worked in, when it repeats daily rather than
	 * running to a deadline; see `dailyWindowSchema`. Absent or `null` for none.
	 */
	dailyWindow: v.optional(v.nullable(dailyWindowSchema)),
	/**
	 * Tags every task in the checklist carries, done or not, including tasks
	 * added later. Taking one off here takes it off them again.
	 *
	 * Absent on checklists made before they could be tagged, which is the same
	 * as none.
	 */
	tagIds: v.optional(v.array(idSchema)),
	/**
	 * In a team, the people who can see it and every task in it, by address;
	 * absent or `null` for everyone. See `visibleToSchema`.
	 */
	visibleTo: v.optional(v.nullable(v.array(v.string()))),
	/** The steps its tasks go through; absent for `DEFAULT_STAGES`. */
	stages: v.optional(v.array(stageSchema)),
	/**
	 * `"inbox"` for the one checklist every space has for tasks that belong to
	 * no other — typed straight onto Today, say. It is made on first use and
	 * cannot be deleted; `null` or absent for every other checklist.
	 */
	special: v.optional(v.nullable(v.literal("inbox"))),
	createdAt: v.string(),
	updatedAt: v.string(),
});

export type Checklist = v.InferOutput<typeof checklistSchema>;

export type ChecklistProgress = {
	total: number;
	completed: number;
	/** Rounded 0-100. `0` when there are no tasks. */
	percent: number;
};

/**
 * A checklist with its progress. Its pace is not here: that is judged on the
 * viewer's clock, in the browser; see `usePace`.
 */
export type ChecklistSummary = Checklist & {
	progress: ChecklistProgress;
};

export const createChecklistInputSchema = v.object({
	checklistId: idSchema,
	title: titleSchema,
	description: v.optional(descriptionSchema, ""),
	startDate: dateOnlySchema,
	deadline: v.optional(v.nullable(dateOnlySchema), null),
	deadlineTime: v.optional(v.nullable(timeOfDaySchema), null),
	dailyWindow: v.optional(v.nullable(dailyWindowSchema), null),
	tagIds: v.optional(tagIdsSchema, []),
	visibleTo: v.optional(visibleToSchema, null),
	stages: v.optional(stagesSchema),
});

export const updateChecklistInputSchema = v.object({
	checklistId: idSchema,
	patch: v.pipe(
		v.object({
			title: v.optional(titleSchema),
			description: v.optional(descriptionSchema),
			startDate: v.optional(dateOnlySchema),
			deadline: v.optional(v.nullable(dateOnlySchema)),
			deadlineTime: v.optional(v.nullable(timeOfDaySchema)),
			dailyWindow: v.optional(v.nullable(dailyWindowSchema)),
			tagIds: v.optional(tagIdsSchema),
			visibleTo: v.optional(visibleToSchema),
			stages: v.optional(stagesSchema),
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});

export const checklistIdInputSchema = v.object({ checklistId: idSchema });

/** A checklist's figures, narrowed to what a screen is filtering to. */
export const checklistReadInputSchema = v.object({
	...checklistIdInputSchema.entries,
	...taskFilterSchema.entries,
});
