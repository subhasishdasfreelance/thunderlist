import * as v from "valibot";
import {
	dailyWindowSchema,
	dateOnlySchema,
	descriptionSchema,
	idSchema,
	tagIdsSchema,
	timeOfDaySchema,
	titleSchema,
} from "./common";
import type { Task } from "./task";

const PACE_STATUSES = ["ahead", "on_track", "behind"] as const;

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

export type ChecklistDetail = ChecklistSummary & {
	/**
	 * The open tasks. The finished ones are read separately and later, though
	 * `progress` counts them all; see `getChecklistCompleted`.
	 */
	tasks: Array<Task>;
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
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});

export const checklistIdInputSchema = v.object({ checklistId: idSchema });
