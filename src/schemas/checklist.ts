import * as v from "valibot";
import { accessSchema } from "./access";
import {
	dailyWindowSchema,
	dateOnlySchema,
	descriptionSchema,
	idSchema,
	imagesSchema,
	tagIdsSchema,
	timeOfDaySchema,
	titleSchema,
} from "./common";
import {
	NOT_STARTED_STAGE_KEY,
	TAG_COLORS,
	type TagColor,
	type TagStage,
} from "./tag";
import { taskFilterSchema } from "./task";

const PACE_STATUSES = ["ahead", "on_track", "behind"] as const;

const stageNameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "Every stage needs a name"),
	v.maxLength(30, "Stage names must be 30 characters or fewer"),
);

const stageSchema = v.object({
	stageId: idSchema,
	name: stageNameSchema,
	/**
	 * What it is drawn in on the progress bar and around its tasks' checkboxes.
	 * Absent for the colour its place starts with; see `stageColor`.
	 */
	color: v.optional(v.picklist(TAG_COLORS)),
});

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
 * The colours stages start in, counted back from done: green for done, blue
 * for the stage before it, and on — the eight that can be picked, so a stage
 * never starts in a colour its own picker does not offer. A checklist with
 * more than eight stages goes round them again.
 */
const DEFAULT_STAGE_COLORS: ReadonlyArray<TagColor> = [
	"green",
	"blue",
	"orange",
	"purple",
	"pink",
	"teal",
	"yellow",
	"red",
];

/**
 * The colour a stage is drawn in: its own, or the one its place starts with.
 *
 * The first stage is never drawn: it is the work not started, the empty track
 * of the bar and a plain checkbox.
 */
export function stageColor(
	stages: ReadonlyArray<Stage>,
	index: number,
): TagColor {
	return (
		stages[index].color ??
		DEFAULT_STAGE_COLORS[
			(stages.length - 1 - index) % DEFAULT_STAGE_COLORS.length
		]
	);
}

/**
 * A colour for a stage being added, before done: the first of the ones stages
 * start in that no other stage has, so a new stage never looks like an old one.
 */
export function unusedStageColor(stages: ReadonlyArray<Stage>): TagColor {
	const taken = new Set(stages.map((_, index) => stageColor(stages, index)));
	return (
		DEFAULT_STAGE_COLORS.find((color) => !taken.has(color)) ??
		DEFAULT_STAGE_COLORS[0]
	);
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
 * Where a task is once its checklist's stages change from `before` to `after`,
 * or `null` where nothing about it changes.
 *
 * A task at a stage that is kept stays there. One at a stage taken away moves
 * back to the nearest stage before it that is left — work under review when
 * review goes is still under way — or to the first. Then whatever is at the
 * last stage is done and nothing else is, as always; a task that follows a
 * tracker or another checklist is left for that to decide.
 *
 * The stage a task names is trusted while it is one of the old ones, however
 * it is ticked: a save that failed partway may have left a task open at the old
 * last stage, and \`stageOf\` would send that one back to the first on the retry.
 */
export function restaged(
	task: {
		stageId?: string | null;
		completed: boolean;
		trackerId?: string | null;
		linkedChecklistId?: string | null;
	},
	before: ReadonlyArray<Stage>,
	after: ReadonlyArray<Stage>,
): { stageId: string; completed: boolean } | null {
	if (task.trackerId != null || task.linkedChecklistId != null) return null;

	const kept = new Set(after.map((stage) => stage.stageId));
	const landing = (stageId: string): string => {
		if (kept.has(stageId)) return stageId;
		const at = before.findIndex((stage) => stage.stageId === stageId);
		for (let index = at - 1; index >= 0; index -= 1) {
			if (kept.has(before[index].stageId)) return before[index].stageId;
		}
		return after[0].stageId;
	};

	const from = before.some((stage) => stage.stageId === task.stageId)
		? (task.stageId as string)
		: stageOf(task, before);
	const stageId = landing(from);
	const completed = stageId === after[after.length - 1].stageId;

	return stageId === from && completed === task.completed
		? null
		: { stageId, completed };
}

/**
 * How far through its checklist's stages a task is, from 0 at the first to 1
 * once done. Ordering by stage goes by this, so tasks from checklists with
 * different stages still fall into one order: every list's first stage
 * together at the top, every done at the bottom, and the stages between in
 * the order of how far along they are — "Review", halfway through three
 * stages, before "QA", two-thirds through four.
 */
export function stageProgress(
	task: { stageId?: string | null; completed: boolean },
	stages: ReadonlyArray<Stage>,
): number {
	const at = stageOf(task, stages);
	return (
		stages.findIndex((stage) => stage.stageId === at) / (stages.length - 1)
	);
}

/**
 * Whether a task is under way: past its checklist's first stage and not yet
 * done — in review, say. A tag's bar draws these as one part; see
 * `tagStageParts`.
 */
function isUnderway(
	task: { stageId?: string | null; completed: boolean },
	stages: ReadonlyArray<Stage>,
): boolean {
	return !task.completed && stageOf(task, stages) !== stages[0].stageId;
}

/**
 * The stage a task is under way at, as a tag's bar counts it: by its name,
 * lowercased, since names are what checklists share — "Review" in two lists
 * is one part of the bar. `null` for a task not under way; see `isUnderway`.
 */
export function underwayStage(
	task: { stageId?: string | null; completed: boolean },
	stages: ReadonlyArray<Stage>,
): TagStage | null {
	if (!isUnderway(task, stages)) return null;

	const index = stages.findIndex(
		(stage) => stage.stageId === stageOf(task, stages),
	);
	return {
		key: stages[index].name.toLowerCase(),
		name: stages[index].name,
		color: stageColor(stages, index),
		rank: index / (stages.length - 1),
	};
}

/**
 * Where an open task is, as a tag's stage filter picks it: the key of the
 * stage it is under way at, or `NOT_STARTED_STAGE_KEY` at its first.
 */
export function tagStageKey(
	task: { stageId?: string | null; completed: boolean },
	stages: ReadonlyArray<Stage>,
): string {
	return underwayStage(task, stages)?.key ?? NOT_STARTED_STAGE_KEY;
}

/**
 * The stages every one of these checklists goes through, where they all go
 * through the same — named alike, in the same order — or `null`. Tasks from
 * several checklists picked at once can be moved to one stage only then; see
 * `SelectionBar`.
 */
export function sharedStages(
	lists: ReadonlyArray<ReadonlyArray<Stage>>,
): ReadonlyArray<Stage> | null {
	const [first] = lists;
	if (first === undefined) return null;
	const same = (stages: ReadonlyArray<Stage>) =>
		stages.length === first.length &&
		stages.every(
			(stage, at) =>
				stage.stageId === first[at].stageId && stage.name === first[at].name,
		);
	return lists.every(same) ? first : null;
}

/**
 * The stage a task goes on to from the one it is at, or `null` once it is
 * done. A task following a tracker or another checklist is finished by that,
 * never by hand, so it goes no further than the stage before done.
 */
export function nextStageId(
	task: {
		stageId?: string | null;
		completed: boolean;
		trackerId?: string | null;
		linkedChecklistId?: string | null;
	},
	stages: ReadonlyArray<Stage>,
): string | null {
	const next =
		stages.findIndex((stage) => stage.stageId === stageOf(task, stages)) + 1;
	const isTracked = task.trackerId != null || task.linkedChecklistId != null;

	return next >= stages.length || (isTracked && next === stages.length - 1)
		? null
		: stages[next].stageId;
}

/** How many tasks are at each stage, by stage id, every stage counted. */
export function countByStage(
	tasks: ReadonlyArray<{ stageId?: string | null; completed: boolean }>,
	stages: ReadonlyArray<Stage>,
): Record<string, number> {
	const counts: Record<string, number> = Object.fromEntries(
		stages.map((stage) => [stage.stageId, 0]),
	);
	for (const task of tasks) counts[stageOf(task, stages)] += 1;
	return counts;
}

/** One stage's part of a checklist's progress bar; see `stageParts`. */
export type StagePart = {
	stageId: string;
	name: string;
	color: TagColor;
	count: number;
};

/**
 * A checklist's stages as its progress bar draws them: done first, then each
 * stage before it, so where each part ends reads as "this many at least this
 * far along". The first stage is left out: it is the bar's empty track, the
 * work not started.
 */
export function stageParts(
	stages: ReadonlyArray<Stage>,
	// Empty for a summary read before it carried the counts: a page kept from
	// the last version of the app draws an empty bar rather than breaking.
	byStage: Readonly<Record<string, number>> = {},
): Array<StagePart> {
	return stages
		.map((stage, index) => ({
			stageId: stage.stageId,
			name: stage.name,
			color: stageColor(stages, index),
			count: byStage[stage.stageId] ?? 0,
		}))
		.slice(1)
		.reverse();
}

/** One stage name across every checklist that has it; see `stagesByName`. */
export type StageGroup<T> = { key: string; name: string; tasks: Array<T> };

/**
 * Tasks from every checklist, by the name of the stage each is at.
 *
 * Each checklist has stages of its own, but the names are what they share —
 * "To do", "Review", "Done" — so here a stage is a name, whatever its case.
 * Every name a checklist has is a group, whether or not any task is at it.
 * They come in the order ordering by stage goes, see `stageProgress`: first
 * stages at the top, done at the bottom, and the rest by how far along they
 * are — by the earliest, for a name at different points in different lists.
 */
export function stagesByName<
	T extends {
		checklistId: string | null;
		stageId?: string | null;
		completed: boolean;
	},
>(
	checklists: ReadonlyArray<{
		checklistId: string;
		stages?: ReadonlyArray<Stage>;
	}>,
	tasks: ReadonlyArray<T>,
): Array<StageGroup<T>> {
	const groups = new Map<string, StageGroup<T>>();
	const earliest = new Map<string, number>();

	/** The group of one of a checklist's stages, made when its name is new. */
	const groupOf = (stages: ReadonlyArray<Stage>, index: number) => {
		const { name } = stages[index];
		const key = name.toLowerCase();
		const along = index / (stages.length - 1);
		earliest.set(key, Math.min(earliest.get(key) ?? along, along));

		const existing = groups.get(key);
		if (existing !== undefined) return existing;
		const group: StageGroup<T> = { key, name, tasks: [] };
		groups.set(key, group);
		return group;
	};

	const stagesById = new Map(
		checklists.map((checklist) => [
			checklist.checklistId,
			checklistStages(checklist),
		]),
	);
	for (const stages of stagesById.values()) {
		for (let index = 0; index < stages.length; index += 1) {
			groupOf(stages, index);
		}
	}

	for (const task of tasks) {
		const stages =
			(task.checklistId === null
				? undefined
				: stagesById.get(task.checklistId)) ?? DEFAULT_STAGES;
		const at = stageOf(task, stages);
		groupOf(
			stages,
			stages.findIndex((stage) => stage.stageId === at),
		).tasks.push(task);
	}

	const rank = (group: StageGroup<T>) => earliest.get(group.key) ?? 0;
	return [...groups.values()].sort(
		(a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name),
	);
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

/**
 * The checklists every space has and cannot lose: the Inbox, for tasks that
 * belong to no other, and the Backlog, for work parked until it is picked.
 * Each is known by its kind rather than its title, which the user can change.
 */
export const SPECIAL_CHECKLISTS = ["inbox", "backlog"] as const;

export type SpecialChecklist = (typeof SPECIAL_CHECKLISTS)[number];

const checklistSchema = v.object({
	checklistId: idSchema,
	/** `C-3`, for people; absent until the server hands it one. See `NUMBER_PREFIXES`. */
	number: v.optional(v.number()),
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
	 * In a team, who may do what with it and every task in it; absent or `null`
	 * for everyone, each at whatever their role allows. See `accessSchema`.
	 *
	 * Read from `visibleTo` on anything written before levels existed, which
	 * named who could see it and left the rest to their role; see
	 * `accessFromVisibleTo`.
	 */
	access: v.optional(accessSchema),
	/** The steps its tasks go through; absent for `DEFAULT_STAGES`. */
	stages: v.optional(v.array(stageSchema)),
	/** Pictures on it, in the order they were added; absent for none. See `ImageRef`. */
	images: v.optional(imagesSchema),
	/**
	 * Flagged urgent, important or both, as a task is; absent for neither.
	 * A group can be ordered by it; see `priorityRank`.
	 */
	urgent: v.optional(v.boolean()),
	important: v.optional(v.boolean()),
	/**
	 * Marked as current focus: listed itself, as a card, on the Current focus
	 * tag's page; see `SPECIAL_TAGS`. Absent for not.
	 */
	focused: v.optional(v.boolean()),
	/**
	 * Which special checklist this is, or `null` or absent for any other; see
	 * `SPECIAL_CHECKLISTS`. `"inbox"` holds the tasks that belong to no other —
	 * typed straight onto Today, say — and `"backlog"` the parked ones. Both
	 * are made on first use and cannot be deleted.
	 */
	special: v.optional(v.nullable(v.picklist(SPECIAL_CHECKLISTS))),
	createdAt: v.string(),
	updatedAt: v.string(),
});

export type Checklist = v.InferOutput<typeof checklistSchema>;

/** The space's checklist of one special kind, once the checklists have loaded. */
export function specialChecklist<T extends Pick<Checklist, "special">>(
	checklists: ReadonlyArray<T>,
	kind: SpecialChecklist,
): T | null {
	return checklists.find((checklist) => checklist.special === kind) ?? null;
}

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
	progress: ChecklistProgress & {
		/** Tasks at each stage, by stage id, for the parts of its bar. */
		byStage: Record<string, number>;
	};
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
	access: v.optional(accessSchema, null),
	stages: v.optional(stagesSchema),
	urgent: v.optional(v.boolean()),
	important: v.optional(v.boolean()),
	/** Sent from the form it was made in; see `useImageDraft`. */
	images: v.optional(imagesSchema),
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
			access: v.optional(accessSchema),
			stages: v.optional(stagesSchema),
			/** Every one of them, in order: the whole list is written each time. */
			images: v.optional(imagesSchema),
			urgent: v.optional(v.boolean()),
			important: v.optional(v.boolean()),
			focused: v.optional(v.boolean()),
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
