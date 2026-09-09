import * as v from "valibot";
import {
	dateOnlySchema,
	descriptionSchema,
	idSchema,
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

/**
 * Where a task typed straight into Today or the Backlog goes.
 *
 * Those lists hold references, never tasks of their own, so a loose task still
 * needs a checklist to live in. It is an ordinary checklist found by title, so
 * it can be renamed, tidied or deleted like any other.
 */
export const INBOX_CHECKLIST_TITLE = "Inbox";

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

export type ChecklistSummary = Checklist & {
	progress: ChecklistProgress;
	status: PaceStatus | null;
};

export type ChecklistDetail = ChecklistSummary & {
	tasks: Array<Task>;
};

export const createChecklistInputSchema = v.object({
	checklistId: idSchema,
	title: titleSchema,
	description: v.optional(descriptionSchema, ""),
	startDate: dateOnlySchema,
	deadline: v.optional(v.nullable(dateOnlySchema), null),
});

export const updateChecklistInputSchema = v.object({
	checklistId: idSchema,
	patch: v.pipe(
		v.object({
			title: v.optional(titleSchema),
			description: v.optional(descriptionSchema),
			startDate: v.optional(dateOnlySchema),
			deadline: v.optional(v.nullable(dateOnlySchema)),
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});

export const checklistIdInputSchema = v.object({ checklistId: idSchema });
