import * as v from "valibot";
import type { ChecklistProgress, StagePart } from "./checklist";
import {
	dailyWindowSchema,
	dateOnlySchema,
	descriptionSchema,
	emailSchema,
	idSchema,
	timeOfDaySchema,
	todayDateOnly,
	visibleToSchema,
} from "./common";
import type { Task } from "./task";
import type { TrackerSummary } from "./tracker";

/**
 * Tag colours are the Astryx `Token` palette, so a tag renders the same
 * everywhere without a lookup table of hex values.
 */
export const TAG_COLORS = [
	"blue",
	"purple",
	"pink",
	"red",
	"orange",
	"yellow",
	"green",
	"teal",
	"cyan",
	"gray",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

const tagColorSchema = v.picklist(TAG_COLORS);

/**
 * The tag every account has and cannot lose: what you are doing today.
 *
 * It is a tag in every other way — a name and a colour, both changeable on the
 * Tags screen — but the row's bolt writes it into a task's title, so it has to
 * exist and cannot be deleted. It is known by its kind rather than its name,
 * because the name is the user's to change.
 *
 * The Backlog was the other, and is a checklist now; see `ensureBacklog`.
 */
export const SPECIAL_TAGS = ["today"] as const;

export type SpecialTag = (typeof SPECIAL_TAGS)[number];

const tagNameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "Tag name is required"),
	v.maxLength(40, "Tag name must be 40 characters or fewer"),
);

/**
 * A tag.
 *
 * Tasks reference a tag by id, never by name, so renaming a tag is a single
 * document write rather than a rewrite of every task that carries it.
 *
 * A tag is a checklist that gathers its tasks by label rather than by holding
 * them, so it can carry the same schedule. Unlike a checklist's, every part of
 * it is optional: a tag is usually born mid-sentence as `#name`, with no form
 * to fill in.
 */
const tagSchema = v.object({
	tagId: idSchema,
	name: tagNameSchema,
	color: tagColorSchema,
	/** Which special tag this is, or `null` for any other; see `SPECIAL_TAGS`. */
	special: v.optional(v.nullable(v.picklist(SPECIAL_TAGS)), null),
	description: v.string(),
	/** The day the work started, or `null` to count from the day it was made. */
	startDate: v.nullable(dateOnlySchema),
	/** The day it should be finished by. Without one there is no pace. */
	deadline: v.nullable(dateOnlySchema),
	/** The time on the deadline day it is due by; see `Checklist.deadlineTime`. */
	deadlineTime: v.optional(v.nullable(timeOfDaySchema)),
	/**
	 * The hours of every day it is worked in, when it repeats daily; see
	 * `dailyWindowSchema`. Today starts with 06:00 to 22:00.
	 */
	dailyWindow: v.optional(v.nullable(dailyWindowSchema)),
	/**
	 * In a team, the people who can see it and the tasks that live under it, by
	 * address; absent or `null` for everyone. Never set on Today, which is
	 * everyone's. See `visibleToSchema`.
	 */
	visibleTo: v.optional(v.nullable(v.array(v.string()))),
	createdAt: v.string(),
	updatedAt: v.string(),
});

export type Tag = v.InferOutput<typeof tagSchema>;

/**
 * The day a tag's figures are measured from.
 *
 * Its own start date when one was set, otherwise the day it was made — the
 * same day a checklist's start date defaults to.
 */
export function tagStartDate(
	tag: Pick<Tag, "startDate" | "createdAt">,
): string {
	return tag.startDate ?? todayDateOnly(new Date(tag.createdAt));
}

/**
 * The tags behind a list of ids, in the same order, skipping any that no
 * longer exist.
 */
export function tagsFor(
	tagIds: ReadonlyArray<string>,
	tags: ReadonlyArray<Tag>,
): Array<Tag> {
	return tagIds.flatMap(
		(tagId) => tags.find((tag) => tag.tagId === tagId) ?? [],
	);
}

/** The account's tag of one special kind, once the tags have loaded. */
export function specialTag(
	tags: ReadonlyArray<Tag>,
	kind: SpecialTag,
): Tag | null {
	return tags.find((tag) => tag.special === kind) ?? null;
}

/**
 * The `$tagId` in a tag's address. A special tag answers to its kind —
 * `/tags/today` — so its page is at the same address in every account, which
 * is what lets the app open on it.
 */
export function tagParam(tag: Pick<Tag, "tagId" | "special">): string {
	return tag.special ?? tag.tagId;
}

/**
 * A tag's progress: counted as a checklist's is, and how many of its open
 * tasks are under way — past the first stage of their checklist; see
 * `isUnderway`.
 */
export type TagProgress = ChecklistProgress & { inProgress: number };

/** A tag with its progress; its pace is judged in the browser, see `usePace`. */
export type TagSummary = Tag & {
	progress: TagProgress;
};

/**
 * A tag's bar in parts, drawn the way a checklist's is: done, then every task
 * under way as one part, whatever its stage — review, QA — since the
 * checklists a tag gathers from each have stages of their own. What is left of
 * the track is the work not started. Under way is left out while nothing is,
 * so a tag whose tasks only ever go from to do to done reads as a plain bar.
 */
export function tagStageParts(
	// No `inProgress` on a summary read before it carried one: a page kept from
	// the last version of the app draws what is done rather than breaking.
	progress: Pick<ChecklistProgress, "completed"> & { inProgress?: number },
): Array<StagePart> {
	const inProgress = progress.inProgress ?? 0;

	return [
		{
			stageId: "done",
			name: "Done",
			color: "green",
			count: progress.completed,
		},
		...(inProgress === 0
			? []
			: [
					{
						stageId: "underway",
						name: "In progress",
						color: "blue" as const,
						count: inProgress,
					},
				]),
	];
}

/** A task carrying a tag, with the checklist it lives in, if any. */
export type TagTaskEntry = {
	task: Task;
	/** `null` for a task that belongs to no checklist. */
	checklistId: string | null;
	checklistTitle: string | null;
};

/** A tracker carrying a tag, with the day it reached its target. */
export type TagTrackerEntry = {
	tracker: TrackerSummary;
	/** `YYYY-MM-DD`, or `null` while the target is still ahead. */
	completedOn: string | null;
};

/**
 * A tag's page, less its tasks: those are read a page at a time, though
 * `progress` counts them all; see `getTagOpenTasks`.
 */
export type TagDetail = TagSummary & {
	/** Each counts once towards the tag's progress, the way a task does. */
	trackers: Array<TagTrackerEntry>;
};

export const createTagInputSchema = v.object({
	tagId: idSchema,
	name: tagNameSchema,
	color: tagColorSchema,
	description: v.optional(descriptionSchema, ""),
	startDate: v.optional(v.nullable(dateOnlySchema), null),
	deadline: v.optional(v.nullable(dateOnlySchema), null),
	deadlineTime: v.optional(v.nullable(timeOfDaySchema), null),
	dailyWindow: v.optional(v.nullable(dailyWindowSchema), null),
	visibleTo: v.optional(visibleToSchema, null),
});

export const updateTagInputSchema = v.object({
	tagId: idSchema,
	patch: v.pipe(
		v.object({
			name: v.optional(tagNameSchema),
			color: v.optional(tagColorSchema),
			description: v.optional(descriptionSchema),
			startDate: v.optional(v.nullable(dateOnlySchema)),
			deadline: v.optional(v.nullable(dateOnlySchema)),
			deadlineTime: v.optional(v.nullable(timeOfDaySchema)),
			dailyWindow: v.optional(v.nullable(dailyWindowSchema)),
			visibleTo: v.optional(visibleToSchema),
		}),
		v.check((patch) => Object.keys(patch).length > 0, "Nothing to update"),
	),
});

export const tagIdInputSchema = v.object({ tagId: idSchema });

/**
 * A tag's figures, narrowed to one person's work in a team; see
 * `taskFilterSchema`. A tag is its own filter, so there is no tag to pick.
 */
export const tagReadInputSchema = v.object({
	...tagIdInputSchema.entries,
	assignee: v.optional(emailSchema),
});
