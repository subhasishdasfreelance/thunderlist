import * as v from "valibot";
import type { PaceStatus } from "./checklist";
import {
	dateOnlySchema,
	descriptionSchema,
	idSchema,
	noteSchema,
	optionalUrlSchema,
	titleSchema,
} from "./common";
import type { Velocity } from "./progress";

export const TRACKER_TYPES = [
	"book",
	"course",
	"project",
	"fitness",
	"custom",
] as const;

export type TrackerType = (typeof TRACKER_TYPES)[number];

const trackerTypeSchema = v.picklist(TRACKER_TYPES);

export const TRACKER_TYPE_LABELS: Record<TrackerType, string> = {
	book: "Book",
	course: "Course",
	project: "Project",
	fitness: "Fitness",
	custom: "Custom",
};

/** Sensible default unit per type; the user can always override it. */
export const TRACKER_TYPE_DEFAULT_UNITS: Record<TrackerType, string> = {
	book: "pages",
	course: "lessons",
	project: "tasks",
	fitness: "km",
	custom: "units",
};

/**
 * Whether progress may exceed the target.
 *
 * Books and courses count discrete, bounded items — there is no page 500 in a
 * 412-page book. Fitness, project and custom goals are targets you can beat.
 */
export function allowsOvershoot(type: TrackerType): boolean {
	return type !== "book" && type !== "course";
}

const unitSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "Unit is required"),
	v.maxLength(24, "Unit must be 24 characters or fewer"),
);

const targetValueSchema = v.pipe(
	v.number(),
	v.finite("Target must be a number"),
	v.minValue(0.0001, "Target must be greater than zero"),
	v.maxValue(1_000_000, "Target is too large"),
);

const progressValueSchema = v.pipe(
	v.number(),
	v.finite("Value must be a number"),
	v.minValue(0, "Value cannot be negative"),
	v.maxValue(1_000_000, "Value is too large"),
);

const authorSchema = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(120, "Author must be 120 characters or fewer"),
);

const trackerSchema = v.object({
	trackerId: idSchema,
	title: titleSchema,
	type: trackerTypeSchema,
	description: v.string(),
	unit: v.string(),
	targetValue: v.number(),
	/** Denormalised from the latest progress entry; see `deriveCurrentValue`. */
	currentValue: v.number(),
	coverUrl: v.nullable(v.string()),
	/** Book-specific but stored generically; blank for other types. */
	author: v.nullable(v.string()),
	/** The day tracking started. Every pace figure is measured from here. */
	startDate: dateOnlySchema,
	/** The day the target should be reached. Without one there is no pace. */
	deadline: v.nullable(dateOnlySchema),
	createdAt: v.string(),
	updatedAt: v.string(),
});

export type Tracker = v.InferOutput<typeof trackerSchema>;

export type TrackerProgress = {
	current: number;
	target: number;
	/** Rounded 0-100, clamped. */
	percent: number;
};

export type TrackerSummary = Tracker & {
	progress: TrackerProgress;
	status: PaceStatus | null;
};

/**
 * One reading in a tracker's history.
 *
 * `value` is the reading — "page 284" — and stays the source of truth for
 * current progress. `delta` is how much that reading moved things on from the
 * one before it, stored alongside so progress over time can be charted without
 * replaying the whole history.
 */
const progressEntrySchema = v.object({
	entryId: idSchema,
	recordedAt: dateOnlySchema,
	value: v.number(),
	delta: v.number(),
	note: v.string(),
	updatedAt: v.string(),
});

export type ProgressEntry = v.InferOutput<typeof progressEntrySchema>;

export type TrackerDetail = TrackerSummary & {
	entries: Array<ProgressEntry>;
	velocity: Velocity;
};

export const createTrackerInputSchema = v.object({
	trackerId: idSchema,
	title: titleSchema,
	type: trackerTypeSchema,
	unit: unitSchema,
	targetValue: targetValueSchema,
	startDate: dateOnlySchema,
	deadline: v.optional(v.nullable(dateOnlySchema), null),
	description: v.optional(descriptionSchema, ""),
	coverUrl: v.optional(optionalUrlSchema, null),
	author: v.optional(authorSchema, ""),
});

export const updateTrackerInputSchema = v.object({
	trackerId: idSchema,
	patch: v.pipe(
		v.object({
			title: v.optional(titleSchema),
			type: v.optional(trackerTypeSchema),
			unit: v.optional(unitSchema),
			targetValue: v.optional(targetValueSchema),
			startDate: v.optional(dateOnlySchema),
			deadline: v.optional(v.nullable(dateOnlySchema)),
			description: v.optional(descriptionSchema),
			coverUrl: v.optional(optionalUrlSchema),
			author: v.optional(authorSchema),
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});

export const trackerIdInputSchema = v.object({ trackerId: idSchema });

/**
 * Progress is always entered as "where I am now", never as an increment: you
 * type 78 after reading to page 78. The delta is worked out from the entry
 * before it, so the reading and the step can never disagree.
 */
export const createProgressEntryInputSchema = v.object({
	trackerId: idSchema,
	entryId: idSchema,
	value: progressValueSchema,
	recordedAt: dateOnlySchema,
	note: v.optional(noteSchema, ""),
});

export const updateProgressEntryInputSchema = v.object({
	trackerId: idSchema,
	entryId: idSchema,
	patch: v.pipe(
		v.object({
			value: v.optional(progressValueSchema),
			recordedAt: v.optional(dateOnlySchema),
			note: v.optional(noteSchema),
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});

export const deleteProgressEntryInputSchema = v.object({
	trackerId: idSchema,
	entryId: idSchema,
});
