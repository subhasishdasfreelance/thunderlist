/**
 * Checklists and their tasks. Server only.
 *
 * A checklist is one document and each of its tasks is another, linked by
 * `checklistId`. Nothing is nested: a task is edited, moved between lists and
 * searched for on its own, and a document per task keeps every one of those a
 * single targeted write rather than a rewrite of the whole checklist.
 *
 * Every task is in a checklist. One written where there is no checklist to put
 * it in — typed onto Today, say — goes into the space's Inbox, which is made on
 * first use and cannot be deleted; see `ensureInbox`. So every task can be
 * moved, and there is always somewhere to find it. The Backlog, where work is
 * parked, is the other checklist every space has; see `ensureBacklog`.
 *
 * A checklist's tasks go through its stages — "To do" and "Done" until it is
 * given more — and a task is complete exactly when it is at the last one; see
 * `Checklist.stages`.
 *
 * Every function here takes the owner first and names it in every filter. A
 * checklist or task id names a row; the owner is what decides whether it is
 * yours, and a row belonging to someone else is simply not found.
 */

import {
	type AnyBulkWriteOperation,
	MongoBulkWriteError,
	MongoServerError,
} from "mongodb";
import { AppError } from "#/lib/errors";
import { createId, ID_PREFIX } from "#/lib/ids";
import {
	type Collections,
	collections,
	DOMAIN_FIELDS,
	type TaskDoc,
} from "#/lib/mongo/client.server";
import { trackerProgress } from "#/lib/progress";
import {
	parseInlineTags,
	sameTagName,
	withoutInlineTag,
} from "#/lib/tags/inline-tags";
import {
	calculateChecklistProgress,
	matchesFilter,
	notesAfterMove,
	orderTasks,
	pageOf,
	type StagePage,
	shortTitle,
} from "#/lib/tasks/tasks";
import type { AccessEntry } from "#/schemas/access";
import type { BatchedChange } from "#/schemas/change";
import {
	type Checklist,
	type ChecklistSummary,
	checklistStages,
	countByStage,
	restaged,
	SPECIAL_CHECKLISTS,
	type SpecialChecklist,
	type Stage,
	stageOf,
} from "#/schemas/checklist";
import {
	type DailyWindow,
	type ItemKind,
	type ItemRef,
	todayDateOnly,
} from "#/schemas/common";
import type { ImportGroupInput } from "#/schemas/group";
import { SPECIAL_TAGS } from "#/schemas/tag";
import {
	subtasksBlocking,
	type Task,
	type TaskFilter,
	type TaskPageView,
	type TaskPatch,
} from "#/schemas/task";
import { nextNumber, nextNumbers } from "./numbers.server";
import { listTaskTypes } from "./settings.server";
import { type Hidden, isTaskVisible, withAccess } from "./visibility.server";

/**
 * Just enough of a task to count progress with. `trackerId` is part of that: a
 * task following a tracker is done when the tracker is, not when it is ticked.
 * `linkedChecklistId` is the same for a task standing for another checklist.
 * Its tags and people are what a filter, and who may see it, go by.
 */
const PROGRESS_FIELDS = {
	_id: 0,
	checklistId: 1,
	completed: 1,
	stageId: 1,
	trackerId: 1,
	linkedChecklistId: 1,
	tagIds: 1,
	assignees: 1,
	// Narrowing to one kind of work narrows the figures too, so the field the
	// filter reads has to come back with them; see `matchesFilter`.
	typeId: 1,
} as const;

/** A task document holds the link to its checklist; a `Task` does not. */
const TASK_FIELDS = { _id: 0, checklistId: 0 } as const;

async function requireChecklist(
	current: Collections,
	userId: string,
	checklistId: string,
): Promise<Checklist> {
	const checklist = await current.checklists.findOne(
		{ checklistId, userId },
		{ projection: DOMAIN_FIELDS },
	);

	if (!checklist) {
		throw new AppError("not_found", "That checklist no longer exists.");
	}

	return checklist;
}

/**
 * A checklist with its progress, and how many of its tasks are at each stage.
 * Its pace is judged in the browser, on the viewer's own clock, which this
 * server does not know; see `usePace`.
 */
function summarise(
	checklist: Checklist,
	tasks: ReadonlyArray<Pick<Task, "completed" | "stageId">>,
): ChecklistSummary {
	return {
		// However its audience was stored, the app reads one field; see
		// `withAccess`.
		...withAccess(checklist),
		progress: {
			...calculateChecklistProgress(tasks),
			byStage: countByStage(tasks, checklistStages(checklist)),
		},
	};
}

/* -------------------------------------------------------------------------- */
/* The Inbox and the Backlog                                                  */
/* -------------------------------------------------------------------------- */

/** What each special checklist is called, and says of itself, when made. */
const SPECIAL_CHECKLIST_DETAILS: Record<
	SpecialChecklist,
	{ title: string; description: string }
> = {
	inbox: {
		title: "Inbox",
		description: "Tasks that belong to no other checklist.",
	},
	backlog: {
		title: "Backlog",
		description: "Work parked until it is picked.",
	},
};

/** Spaces whose Inbox this server has already seen to, with its id. */
const inboxes = new Map<string, string>();

/** Spaces whose Backlog this server has already seen to, with its id. */
const backlogs = new Map<string, string>();

/** Two first requests raced to make the same checklist; the other won. */
function isDuplicateKey(error: unknown): boolean {
	return error instanceof MongoServerError && error.code === 11000;
}

/**
 * The space's special checklist of one kind, made if it has none yet. The
 * unique index on `(userId, special)` settles two first requests arriving at
 * once.
 */
async function ensureSpecialChecklist(
	current: Collections,
	userId: string,
	kind: SpecialChecklist,
): Promise<string> {
	const find = async () =>
		(
			await current.checklists.findOne(
				{ userId, special: kind },
				{ projection: { _id: 0, checklistId: 1 } },
			)
		)?.checklistId ?? null;

	const found = await find();
	if (found !== null) return found;

	const now = new Date().toISOString();
	const checklistId = createId(ID_PREFIX.checklist);

	try {
		await current.checklists.insertOne({
			checklistId,
			number: await nextNumber(current, userId, "checklist"),
			...SPECIAL_CHECKLIST_DETAILS[kind],
			startDate: todayDateOnly(),
			deadline: null,
			deadlineTime: null,
			dailyWindow: null,
			tagIds: [],
			access: null,
			special: kind,
			createdAt: now,
			updatedAt: now,
			userId,
		});
		return checklistId;
	} catch (error) {
		if (!isDuplicateKey(error)) throw error;
		const winner = await find();
		if (winner === null) throw error;
		return winner;
	}
}

/**
 * The space's Inbox, made if it has none yet, with every task that belongs to
 * no checklist moved into it.
 *
 * Tasks used to be able to belong to none — the ones typed onto a tag's page —
 * and those could then never be moved into a list. The first time a space is
 * seen they are gathered here.
 */
export async function ensureInbox(userId: string): Promise<string> {
	const known = inboxes.get(userId);
	if (known !== undefined) return known;

	const current = await collections();
	const inboxId = await ensureSpecialChecklist(current, userId, "inbox");

	await current.tasks.updateMany(
		{ userId, checklistId: null },
		{ $set: { checklistId: inboxId } },
	);

	inboxes.set(userId, inboxId);
	return inboxId;
}

/**
 * The space's Backlog, made if it has none yet: where work is parked until it
 * is picked.
 *
 * The Backlog used to be a special tag. The first time a space is seen, every
 * task still carrying it is moved in here — the `#name` taken out of its
 * title, and the rest as any move leaves it; see `moveTask` — and the tag is
 * deleted. After that there is nothing to move.
 */
export async function ensureBacklog(userId: string): Promise<string> {
	const known = backlogs.get(userId);
	if (known !== undefined) return known;

	const current = await collections();
	const backlogId = await ensureSpecialChecklist(current, userId, "backlog");

	// Special, but of no kind a tag can be any more: the old Backlog.
	const tag = await current.tags.findOne(
		{ userId, special: { $nin: [...SPECIAL_TAGS, null] } },
		{ projection: { _id: 0, tagId: 1, name: 1 } },
	);

	if (tag) {
		const carrying = await current.tasks
			.find(
				{ userId, tagIds: tag.tagId },
				{ projection: { _id: 0, taskId: 1, title: 1 } },
			)
			.toArray();

		// The tag comes off first, so each move sees the task as it will be.
		if (carrying.length > 0) {
			await current.tasks.bulkWrite(
				carrying.map((task) => ({
					updateOne: {
						filter: { userId, taskId: task.taskId },
						update: {
							$set: { title: withoutInlineTag(task.title, tag.name) },
							$pull: { tagIds: tag.tagId },
						},
					},
				})),
			);
		}
		await Promise.all(
			carrying.map((task) => moveTask(userId, task.taskId, backlogId)),
		);

		// Nothing is left pointing at it, and then it goes; see `deleteTag`.
		await Promise.all([
			current.checklists.updateMany(
				{ userId, tagIds: tag.tagId },
				{ $pull: { tagIds: tag.tagId } },
			),
			current.trackers.updateMany(
				{ userId, tagIds: tag.tagId },
				{ $pull: { tagIds: tag.tagId } },
			),
		]);
		await current.tags.deleteOne({ userId, tagId: tag.tagId });
	}

	backlogs.set(userId, backlogId);
	return backlogId;
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/** The Inbox first, then the Backlog, then every other checklist. */
function specialRank(checklist: Pick<Checklist, "special">): number {
	return checklist.special == null
		? SPECIAL_CHECKLISTS.length
		: SPECIAL_CHECKLISTS.indexOf(checklist.special);
}

/**
 * Every checklist with its progress, the Inbox and the Backlog first.
 *
 * Two reads, whatever the number of checklists: the checklists themselves, and
 * the completed flag of every task grouped by the checklist it belongs to. A
 * third reads the trackers those tasks follow, when any do.
 */
export async function listChecklists(
	userId: string,
	hidden: Hidden,
): Promise<Array<ChecklistSummary>> {
	await ensureInbox(userId);
	await ensureBacklog(userId);
	const current = await collections();

	const [checklists, stored] = await Promise.all([
		current.checklists
			.find({ userId }, { projection: DOMAIN_FIELDS })
			.toArray(),
		current.tasks.find({ userId }, { projection: PROGRESS_FIELDS }).toArray(),
	]);

	// Counted the same way the checklist itself counts them, or a task finished
	// by its tracker shows as done inside the checklist and not on its card.
	const tasks = await withTrackedCompletion(
		current,
		userId,
		stored.filter((task) => isTaskVisible(task, hidden)),
	);

	const byChecklist = new Map<
		string,
		Array<Pick<Task, "completed" | "stageId">>
	>();
	for (const task of tasks) {
		if (task.checklistId === null) continue;

		const existing = byChecklist.get(task.checklistId);
		if (existing) existing.push(task);
		else byChecklist.set(task.checklistId, [task]);
	}

	return (
		checklists
			// Kept from this person in their team: to them it does not exist.
			.filter((checklist) => !hidden.checklistIds.has(checklist.checklistId))
			// Where anything without a home lands, then where work is parked:
			// where you look first.
			.sort((a, b) => specialRank(a) - specialRank(b))
			.map((checklist) =>
				summarise(checklist, byChecklist.get(checklist.checklistId) ?? []),
			)
	);
}

/**
 * Fill in the completion of any task that stands for something else: a
 * tracker, done when it reaches its target, or another checklist, done when
 * every task in it is.
 *
 * Worked out on every read rather than written to the task, because the thing
 * it depends on moves on its own: recording progress would otherwise have to
 * remember to go and tick a task somewhere else, and the day it forgot, the
 * list would be lying. Ordinary tasks are handed back untouched, and a set with
 * none costs no query at all.
 *
 * `within` is the checklists already being worked out further up; see
 * `checklistsFinished`.
 */
export async function withTrackedCompletion<
	T extends Pick<Task, "trackerId" | "linkedChecklistId" | "completed">,
>(
	current: Collections,
	userId: string,
	tasks: ReadonlyArray<T>,
	within: ReadonlySet<string> = new Set(),
): Promise<Array<T>> {
	// `== null` rather than `=== null`: a task stored before trackers or nested
	// checklists existed has no such field at all, and is as ordinary as one
	// that says `null`.
	const trackerIds = [
		...new Set(
			tasks.flatMap((task) => (task.trackerId == null ? [] : [task.trackerId])),
		),
	];
	const checklistIds = [
		...new Set(
			tasks.flatMap((task) =>
				task.linkedChecklistId == null ? [] : [task.linkedChecklistId],
			),
		),
	];

	if (trackerIds.length === 0 && checklistIds.length === 0) return [...tasks];

	const [reached, finished] = await Promise.all([
		trackersReached(current, userId, trackerIds),
		checklistsFinished(current, userId, checklistIds, within),
	]);

	return tasks.map((task) => {
		if (task.trackerId != null) {
			return { ...task, completed: reached.get(task.trackerId) ?? false };
		}
		if (task.linkedChecklistId != null) {
			return {
				...task,
				completed: finished.get(task.linkedChecklistId) ?? false,
			};
		}
		return task;
	});
}

/** Whether each tracker has reached its target. No ids, no query. */
async function trackersReached(
	current: Collections,
	userId: string,
	trackerIds: ReadonlyArray<string>,
): Promise<Map<string, boolean>> {
	if (trackerIds.length === 0) return new Map();

	const trackers = await current.trackers
		.find(
			{ userId, trackerId: { $in: [...trackerIds] } },
			{
				projection: {
					_id: 0,
					trackerId: 1,
					currentValue: 1,
					targetValue: 1,
					startValue: 1,
				},
			},
		)
		.toArray();

	return new Map(
		trackers.map((tracker) => [
			tracker.trackerId,
			trackerProgress(
				tracker.currentValue,
				tracker.targetValue,
				tracker.startValue,
			).percent >= 100,
		]),
	);
}

/**
 * Whether each checklist is finished: it has tasks, and every one is done.
 *
 * A checklist's own tasks can stand for further checklists, so this goes down
 * a level at a time, one read each. Creating a task refuses to put a checklist
 * inside itself, but two such tasks written at the same moment could still
 * close a loop — so a checklist met again on the way down counts as unfinished
 * rather than being followed round forever.
 */
async function checklistsFinished(
	current: Collections,
	userId: string,
	checklistIds: ReadonlyArray<string>,
	within: ReadonlySet<string>,
): Promise<Map<string, boolean>> {
	const fresh = checklistIds.filter((checklistId) => !within.has(checklistId));
	if (fresh.length === 0) return new Map();

	const stored = await current.tasks
		.find(
			{ userId, checklistId: { $in: fresh } },
			{ projection: PROGRESS_FIELDS },
		)
		.toArray();

	const tasks = await withTrackedCompletion(
		current,
		userId,
		stored,
		new Set([...within, ...fresh]),
	);

	return new Map(
		fresh.map((checklistId) => {
			const own = tasks.filter((task) => task.checklistId === checklistId);
			return [
				checklistId,
				own.length > 0 && own.every((task) => task.completed),
			];
		}),
	);
}

/**
 * A checklist with its progress, for the top of its screen — counting only
 * the tasks a filter lets through, when the screen is filtering.
 *
 * Every task is counted, but none comes back: they are read a page at a time,
 * one stage at a time; see `getChecklistStageTasks`.
 */
export async function getChecklist(
	userId: string,
	checklistId: string,
	hidden: Hidden,
	filter: TaskFilter = {},
): Promise<ChecklistSummary> {
	const current = await collections();
	const checklist = await requireChecklist(current, userId, checklistId);

	const stored = await current.tasks
		.find({ checklistId, userId }, { projection: PROGRESS_FIELDS })
		.toArray();

	return summarise(
		checklist,
		await withTrackedCompletion(
			current,
			userId,
			stored.filter(
				(task) => isTaskVisible(task, hidden) && matchesFilter(task, filter),
			),
		),
	);
}

/**
 * A page of the tasks at one of a checklist's stages, in the order its screen
 * shows them, with how many tasks are at each stage.
 *
 * With no stage asked for, it is the stage of the task to reveal, or the
 * first. Every task is still read, since which stage each is at is only known
 * once completion has been worked out; see `readChecklistTasks`. Only the page
 * asked for is sent.
 */
export async function getChecklistStageTasks(
	userId: string,
	checklistId: string,
	view: TaskPageView,
	hidden: Hidden,
): Promise<StagePage> {
	const current = await collections();
	const checklist = await requireChecklist(current, userId, checklistId);
	const stages = checklistStages(checklist);

	const tasks = (
		await readChecklistTasks(current, userId, checklist, hidden)
	).filter((task) => matchesFilter(task, view));

	const counts = countByStage(tasks, stages);

	const revealed = tasks.find((task) => task.taskId === view.reveal);
	const stageId = stages.some((stage) => stage.stageId === view.stageId)
		? (view.stageId as string)
		: revealed === undefined
			? stages[0].stageId
			: stageOf(revealed, stages);

	const atStage = tasks.filter((task) => task.stageId === stageId);
	// Only ordering by type needs the space's list, so only then is it read.
	const types = view.sort === "type" ? await listTaskTypes(userId) : undefined;

	return {
		...pageOf(
			orderTasks(atStage, view.sort, types),
			view,
			(task) => task.taskId,
		),
		stageId,
		counts,
	};
}

/**
 * The finished tasks of a checklist, for the chart drawn from them and for
 * clearing them — both of which need every one, so they are read whole.
 */
export async function getChecklistCompleted(
	userId: string,
	checklistId: string,
	hidden: Hidden,
): Promise<Array<Task>> {
	const current = await collections();
	const checklist = await requireChecklist(current, userId, checklistId);

	const tasks = await readChecklistTasks(current, userId, checklist, hidden);
	return tasks.filter((task) => task.completed);
}

/**
 * Every task in a checklist this person can see, with completion worked out
 * for the ones that follow a tracker or another checklist — which is why even
 * the finished ones alone cannot be picked out by a query — and the stage each
 * is at filled in.
 */
async function readChecklistTasks(
	current: Collections,
	userId: string,
	checklist: Checklist,
	hidden: Hidden,
): Promise<Array<Task>> {
	const { checklistId } = checklist;
	const stored = await current.tasks
		.find({ checklistId, userId }, { projection: TASK_FIELDS })
		.toArray();

	// Only the Inbox's can be kept from someone who can see the checklist.
	const visible = stored.filter((task) =>
		isTaskVisible({ checklistId, tagIds: task.tagIds }, hidden),
	);
	const stages = checklistStages(checklist);

	return (await withTrackedCompletion(current, userId, visible)).map(
		(task) => ({ ...task, stageId: stageOf(task, stages) }),
	);
}

/* -------------------------------------------------------------------------- */
/* Checklist lifecycle                                                        */
/* -------------------------------------------------------------------------- */

export async function createChecklist(
	userId: string,
	input: {
		checklistId: string;
		title: string;
		description: string;
		startDate: string;
		deadline: string | null;
		deadlineTime: string | null;
		dailyWindow: DailyWindow | null;
		tagIds: Array<string>;
		access: Array<AccessEntry> | null;
		stages?: Array<Stage>;
		urgent?: boolean;
		important?: boolean;
	},
): Promise<Checklist> {
	const current = await collections();

	// Replaying a change that already went in must not create a second copy; see
	// `applyChanges`, which can retry after a partial failure.
	const existing = await current.checklists.findOne(
		{ checklistId: input.checklistId, userId },
		{ projection: DOMAIN_FIELDS },
	);
	if (existing) return existing;

	const now = new Date().toISOString();
	// Listed field by field rather than spread: the caller passes the whole
	// queued change, and spreading it would store its `kind` alongside.
	const checklist: Checklist = {
		checklistId: input.checklistId,
		title: input.title,
		description: input.description,
		startDate: input.startDate,
		deadline: input.deadline,
		deadlineTime: input.deadlineTime,
		dailyWindow: input.dailyWindow,
		tagIds: input.tagIds,
		access: input.access,
		...(input.stages === undefined ? {} : { stages: input.stages }),
		...(input.urgent ? { urgent: true } : {}),
		...(input.important ? { important: true } : {}),
		createdAt: now,
		updatedAt: now,
	};

	checklist.number = await nextNumber(current, userId, "checklist");
	await current.checklists.insertOne({ ...checklist, userId });

	return checklist;
}

/**
 * The tags among `tagIds` a title does not write as `#name`: the ones a task
 * only inherited from its checklist, and so can lose with it. A tag its title
 * does write was typed, and taking it away would leave the title naming a tag
 * the task no longer carries.
 */
function untypedTags(
	title: string,
	tagIds: ReadonlyArray<string>,
	names: ReadonlyMap<string, string>,
): Array<string> {
	const typed = parseInlineTags(title).tagNames;

	return tagIds.filter((tagId) => {
		const name = names.get(tagId);
		return (
			name === undefined ||
			!typed.some((typedName) => sameTagName(typedName, name))
		);
	});
}

/**
 * Bring a checklist's tasks in line with a change to its tags.
 *
 * An added tag goes onto every task in it, done or not. A removed one comes off
 * every task — except one whose title still says `#name`: that tag was typed,
 * not inherited, and taking it away would leave the title naming a tag the task
 * no longer carries.
 */
async function retagTasks(
	current: Collections,
	userId: string,
	checklistId: string,
	before: ReadonlyArray<string>,
	after: ReadonlyArray<string>,
): Promise<void> {
	await retagManyTasks(current, userId, [
		{
			checklistId,
			added: after.filter((tagId) => !before.includes(tagId)),
			removed: before.filter((tagId) => !after.includes(tagId)),
		},
	]);
}

/**
 * `retagTasks` for several checklists at once, each with the tags it gains
 * and loses: one write for every task gaining one, one for every task losing
 * one.
 */
export async function retagManyTasks(
	current: Collections,
	userId: string,
	checklists: ReadonlyArray<{
		checklistId: string;
		added: ReadonlyArray<string>;
		removed: ReadonlyArray<string>;
	}>,
): Promise<void> {
	const adding = checklists.filter((each) => each.added.length > 0);
	if (adding.length > 0) {
		await current.tasks.bulkWrite(
			adding.map((each) => ({
				updateMany: {
					filter: { userId, checklistId: each.checklistId },
					update: { $addToSet: { tagIds: { $each: [...each.added] } } },
				},
			})),
		);
	}

	const removedFrom = new Map(
		checklists
			.filter((each) => each.removed.length > 0)
			.map((each) => [each.checklistId, each.removed]),
	);
	if (removedFrom.size === 0) return;
	const removed = [...new Set([...removedFrom.values()].flat())];

	const [tags, tasks] = await Promise.all([
		current.tags
			.find(
				{ userId, tagId: { $in: removed } },
				{ projection: { _id: 0, tagId: 1, name: 1 } },
			)
			.toArray(),
		current.tasks
			.find(
				{
					userId,
					checklistId: { $in: [...removedFrom.keys()] },
					tagIds: { $in: removed },
				},
				{ projection: { _id: 0, taskId: 1, title: 1, checklistId: 1 } },
			)
			.toArray(),
	]);

	if (tasks.length === 0) return;

	const names = new Map(tags.map((tag) => [tag.tagId, tag.name]));

	await current.tasks.bulkWrite(
		tasks.map((task) => ({
			updateOne: {
				filter: { taskId: task.taskId, userId },
				update: {
					$pull: {
						tagIds: {
							$in: untypedTags(
								task.title,
								removedFrom.get(task.checklistId ?? "") ?? [],
								names,
							),
						},
					},
				},
			},
		})),
	);
}

/**
 * Bring a checklist's tasks in line with a change to its stages; see
 * `restaged`.
 */
async function restageTasks(
	current: Collections,
	userId: string,
	checklistId: string,
	before: ReadonlyArray<Stage>,
	after: ReadonlyArray<Stage>,
): Promise<void> {
	const tasks = await current.tasks
		.find(
			{ userId, checklistId },
			{
				projection: {
					_id: 0,
					taskId: 1,
					stageId: 1,
					completed: 1,
					trackerId: 1,
					linkedChecklistId: 1,
				},
			},
		)
		.toArray();

	const now = new Date().toISOString();
	const writes: Array<AnyBulkWriteOperation<TaskDoc>> = tasks.flatMap(
		(task) => {
			const next = restaged(task, before, after);
			if (next === null) return [];

			return [
				{
					updateOne: {
						filter: { userId, taskId: task.taskId },
						update: {
							$set: {
								...next,
								...(next.completed === task.completed
									? {}
									: { completedAt: next.completed ? now : null }),
							},
						},
					},
				},
			];
		},
	);

	if (writes.length > 0) await current.tasks.bulkWrite(writes);
}

export async function updateChecklist(
	userId: string,
	checklistId: string,
	patch: {
		title?: string;
		description?: string;
		startDate?: string;
		deadline?: string | null;
		deadlineTime?: string | null;
		dailyWindow?: DailyWindow | null;
		tagIds?: Array<string>;
		access?: Array<AccessEntry> | null;
		stages?: Array<Stage>;
	},
): Promise<Checklist> {
	const current = await collections();
	const before = await requireChecklist(current, userId, checklistId);

	// The Inbox and the Backlog are everyone's, in a team as anywhere.
	const changes = before.special != null ? { ...patch, access: null } : patch;

	/*
	 * A checklist's tags and stages are carried by its tasks, so changing them
	 * changes the tasks too. The tasks go first: if this fails part-way the
	 * checklist still has its old ones, and trying again works out the same
	 * difference and finishes the job.
	 */
	if (patch.tagIds !== undefined) {
		await retagTasks(
			current,
			userId,
			checklistId,
			before.tagIds ?? [],
			patch.tagIds,
		);
	}

	if (patch.stages !== undefined) {
		await restageTasks(
			current,
			userId,
			checklistId,
			checklistStages(before),
			patch.stages,
		);
	}

	const next = await current.checklists.findOneAndUpdate(
		{ checklistId, userId },
		{
			$set: { ...changes, updatedAt: new Date().toISOString() },
			// Written with a list of its own, it stops being read from the old
			// field; leaving both would mean two answers to the same question.
			...(changes.access === undefined ? {} : { $unset: { visibleTo: "" } }),
		},
		{ returnDocument: "after", projection: DOMAIN_FIELDS },
	);

	if (!next) {
		throw new AppError("not_found", "That checklist no longer exists.");
	}

	return next;
}

/**
 * Remove a checklist and the tasks in it. The Inbox and the Backlog are
 * refused: tasks with nowhere else to go are put in the one, and parked work
 * in the other, so both have to exist.
 *
 * The tasks go first: a checklist left holding tasks is still usable, whereas
 * tasks whose checklist has gone belong to nothing and cannot be reached.
 */
export async function deleteChecklist(
	userId: string,
	checklistId: string,
): Promise<void> {
	await deleteChecklists(userId, [checklistId]);
}

/**
 * Delete several checklists and all their tasks at once — a pick of them on
 * the Checklists screen — in a handful of writes for all of them. The Inbox
 * and the Backlog are never among them; one asked for refuses the lot.
 */
export async function deleteChecklists(
	userId: string,
	checklistIds: ReadonlyArray<string>,
): Promise<void> {
	const current = await collections();
	const ids = [...checklistIds];

	const special = await current.checklists.findOne(
		{ userId, checklistId: { $in: ids }, special: { $ne: null } },
		{ projection: { _id: 0, title: 1 } },
	);
	if (special) {
		throw new AppError("invalid_data", `"${special.title}" can't be deleted.`);
	}

	// Asked before their tasks go, while there is still something to ask.
	const finished = await checklistsFinished(current, userId, ids, new Set());
	const isFinished = (checklistId: string) =>
		finished.get(checklistId) ?? false;

	const gone = await current.tasks
		.find(
			{ userId, checklistId: { $in: ids } },
			{ projection: { _id: 0, taskId: 1 } },
		)
		.toArray();
	await current.tasks.deleteMany({ userId, checklistId: { $in: ids } });
	await current.checklists.deleteMany({ userId, checklistId: { $in: ids } });
	await releaseFollowers(
		userId,
		"linkedChecklistId",
		ids.filter(isFinished),
		true,
	);
	await releaseFollowers(
		userId,
		"linkedChecklistId",
		ids.filter((checklistId) => !isFinished(checklistId)),
		false,
	);
	await clearDependencies(userId, "checklist", ids);
	await clearDependencies(
		userId,
		"task",
		gone.map((task) => task.taskId),
	);
}

/**
 * Make the tasks standing for a deleted tracker or checklist ordinary tasks,
 * done or not as they last showed. Still pointing at something gone, such a
 * task could never be ticked — it follows that thing — nor finished by it.
 */
export async function releaseFollowers(
	userId: string,
	link: "trackerId" | "linkedChecklistId",
	ids: ReadonlyArray<string>,
	isDone: boolean,
): Promise<void> {
	if (ids.length === 0) return;
	const current = await collections();

	await current.tasks.updateMany(
		{ userId, [link]: { $in: [...ids] } },
		{
			$set: {
				[link]: null,
				completed: isDone,
				completedAt: isDone ? new Date().toISOString() : null,
			},
		},
	);
}

/**
 * Take deleted things off every task waiting on them; see `Task.dependsOn`.
 * Waiting on something that no longer exists would be waiting forever.
 */
export async function clearDependencies(
	userId: string,
	kind: ItemKind,
	ids: ReadonlyArray<string>,
): Promise<void> {
	if (ids.length === 0) return;
	const current = await collections();

	await current.tasks.updateMany(
		{ userId, dependsOn: { $elemMatch: { kind, id: { $in: [...ids] } } } },
		// The driver's types do not follow a condition inside `$pull`.
		{ $pull: { dependsOn: { kind, id: { $in: [...ids] } } as never } },
	);
}

/** A thing a task waits on, as a key to look it up by. */
function refKey(ref: ItemRef): string {
	return `${ref.kind}:${ref.id}`;
}

/**
 * Everything among `refs` that is not done yet, each named the way a refusal
 * says it — `task "Write the brief"` — by `refKey`. Done is judged as
 * everywhere else: a tracker by its target, a checklist or a tag once it has
 * tasks and every one is done; see `withTrackedCompletion`.
 *
 * Read in one go however many tasks it is asked for, so a batch finishing
 * fifty tasks asks once rather than fifty times; see `updateTasks`.
 */
async function undoneAmong(
	current: Collections,
	userId: string,
	refs: ReadonlyArray<ItemRef>,
): Promise<Map<string, string>> {
	const undone = new Map<string, string>();
	const idsOf = (kind: ItemKind) => [
		...new Set(refs.filter((ref) => ref.kind === kind).map((ref) => ref.id)),
	];

	const taskIds = idsOf("task");
	if (taskIds.length > 0) {
		const tasks = await withTrackedCompletion(
			current,
			userId,
			await current.tasks
				.find(
					{ userId, taskId: { $in: taskIds } },
					{
						projection: {
							_id: 0,
							taskId: 1,
							title: 1,
							completed: 1,
							trackerId: 1,
							linkedChecklistId: 1,
						},
					},
				)
				.toArray(),
		);
		for (const task of tasks) {
			if (task.completed) continue;
			undone.set(
				refKey({ kind: "task", id: task.taskId }),
				`task "${shortTitle(task.title, 40)}"`,
			);
		}
	}

	const checklistIds = idsOf("checklist");
	if (checklistIds.length > 0) {
		const finished = await checklistsFinished(
			current,
			userId,
			checklistIds,
			new Set(),
		);
		const open = checklistIds.filter((id) => finished.get(id) !== true);
		const found =
			open.length === 0
				? []
				: await current.checklists
						.find(
							{ userId, checklistId: { $in: open } },
							{ projection: { _id: 0, checklistId: 1, title: 1 } },
						)
						.toArray();
		for (const checklist of found) {
			undone.set(
				refKey({ kind: "checklist", id: checklist.checklistId }),
				`checklist "${shortTitle(checklist.title, 40)}"`,
			);
		}
	}

	const trackerIds = idsOf("tracker");
	if (trackerIds.length > 0) {
		const reached = await trackersReached(current, userId, trackerIds);
		const open = trackerIds.filter((id) => reached.get(id) === false);
		const found =
			open.length === 0
				? []
				: await current.trackers
						.find(
							{ userId, trackerId: { $in: open } },
							{ projection: { _id: 0, trackerId: 1, title: 1 } },
						)
						.toArray();
		for (const tracker of found) {
			undone.set(
				refKey({ kind: "tracker", id: tracker.trackerId }),
				`tracker "${shortTitle(tracker.title, 40)}"`,
			);
		}
	}

	const tagIds = idsOf("tag");
	if (tagIds.length > 0) {
		const [tags, tagged] = await Promise.all([
			current.tags
				.find(
					{ userId, tagId: { $in: tagIds } },
					{ projection: { _id: 0, tagId: 1, name: 1 } },
				)
				.toArray(),
			current.tasks
				.find(
					{ userId, tagIds: { $in: tagIds } },
					{ projection: PROGRESS_FIELDS },
				)
				.toArray(),
		]);
		const tasks = await withTrackedCompletion(current, userId, tagged);
		for (const tag of tags) {
			const own = tasks.filter((task) => task.tagIds.includes(tag.tagId));
			if (own.length === 0 || own.some((task) => !task.completed)) {
				undone.set(refKey({ kind: "tag", id: tag.tagId }), `tag #${tag.name}`);
			}
		}
	}

	return undone;
}

/**
 * The first thing on a task's list that is not done yet, as `undoneAmong`
 * names it, or `null` when all are done: a task first, then a checklist, a
 * tracker and a tag.
 */
function firstUndone(
	refs: ReadonlyArray<ItemRef>,
	undone: ReadonlyMap<string, string>,
): string | null {
	for (const kind of ["task", "checklist", "tracker", "tag"] as const) {
		const ref = refs.find(
			(each) => each.kind === kind && undone.has(refKey(each)),
		);
		if (ref !== undefined) return undone.get(refKey(ref)) ?? null;
	}
	return null;
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export async function createTask(
	userId: string,
	input: {
		/** `null` for the Inbox; see `ensureInbox`. */
		checklistId: string | null;
		taskId: string;
		title: string;
		addedAt: string;
		tagIds: Array<string>;
		urgent: boolean;
		important: boolean;
		/** The number it had, for one put back; see `createTaskInputSchema`. */
		number?: number;
		/** A tracker this task stands for; see `taskSchema`. */
		trackerId?: string | null;
		/** A checklist this task stands for; see `taskSchema`. */
		linkedChecklistId?: string | null;
	},
): Promise<Task> {
	const current = await collections();
	const checklistId = input.checklistId ?? (await ensureInbox(userId));
	// The checklist must be a real one, and one of this user's — which is what
	// stops a task being filed into a stranger's checklist by guessing its id.
	const checklist = await requireChecklist(current, userId, checklistId);

	const existing = await current.tasks.findOne(
		{ taskId: input.taskId, userId },
		{ projection: TASK_FIELDS },
	);
	if (existing) return existing;

	const linkedChecklistId = input.linkedChecklistId ?? null;
	if (linkedChecklistId !== null) {
		// The same rule as the checklist it lives in: real, and this user's.
		await requireChecklist(current, userId, linkedChecklistId);
		await assertCanContain(current, userId, checklistId, linkedChecklistId);
	}

	const task: Task = {
		taskId: input.taskId,
		title: input.title,
		completed: false,
		completedAt: null,
		// The client stamped this when the task was queued, which is the moment
		// the user actually added it and the order they saw it in.
		addedAt: input.addedAt || new Date().toISOString(),
		// It carries its checklist's tags from the start, like every task in it.
		tagIds: [...new Set([...input.tagIds, ...(checklist.tagIds ?? [])])],
		urgent: input.urgent,
		important: input.important,
		trackerId: input.trackerId ?? null,
		linkedChecklistId,
	};

	// Its old number, put back by an undo, while nothing else has taken it.
	const isFree =
		input.number !== undefined &&
		(await current.tasks.findOne(
			{ userId, number: input.number },
			{ projection: { _id: 1 } },
		)) === null;
	task.number = isFree
		? (input.number as number)
		: await nextNumber(current, userId, "task");
	try {
		await current.tasks.insertOne({ ...task, userId, checklistId });
	} catch (error) {
		// A retry that overlapped the first try, which got there first: the task
		// is saved, which is all this was asked for.
		if (!isDuplicateKey(error)) throw error;
		const saved = await current.tasks.findOne(
			{ taskId: input.taskId, userId },
			{ projection: TASK_FIELDS },
		);
		if (saved === null) throw error;
		return saved;
	}

	return task;
}

/**
 * Add many tasks to one checklist at once — a pasted list — with one read, one
 * run of numbers and one write, rather than a round trip each.
 *
 * Asked again after a dropped connection, the ones already written are left
 * as they are and only the rest are added, as `createTask` does for one.
 */
export async function createTasks(
	userId: string,
	checklistId: string | null,
	inputs: ReadonlyArray<{
		taskId: string;
		title: string;
		addedAt: string;
		tagIds: Array<string>;
		urgent: boolean;
		important: boolean;
		trackerId: string | null;
		linkedChecklistId: string | null;
		/** The number it had, for one put back; see `createTasksInputSchema`. */
		number?: number;
	}>,
): Promise<void> {
	const current = await collections();
	const listId = checklistId ?? (await ensureInbox(userId));
	const checklist = await requireChecklist(current, userId, listId);

	const written = await current.tasks
		.find(
			{ userId, taskId: { $in: inputs.map((input) => input.taskId) } },
			{ projection: { _id: 0, taskId: 1 } },
		)
		.toArray();
	const isWritten = new Set(written.map((task) => task.taskId));
	const fresh = inputs.filter((input) => !isWritten.has(input.taskId));
	if (fresh.length === 0) return;

	const linked = new Set(
		fresh.flatMap((input) => input.linkedChecklistId ?? []),
	);
	for (const linkedChecklistId of linked) {
		await requireChecklist(current, userId, linkedChecklistId);
		await assertCanContain(current, userId, listId, linkedChecklistId);
	}

	// The numbers they had, put back by an undo, while nothing else has taken
	// them; the rest are given the next ones, as one is by `createTask`.
	const asked = fresh.flatMap((input) => input.number ?? []);
	const taken = new Set(
		asked.length === 0
			? []
			: (
					await current.tasks
						.find(
							{ userId, number: { $in: asked } },
							{ projection: { _id: 0, number: 1 } },
						)
						.toArray()
				).map((task) => task.number),
	);
	const keeps = (input: (typeof fresh)[number]) =>
		input.number !== undefined && !taken.has(input.number);
	const needing = fresh.filter((input) => !keeps(input)).length;
	let next =
		needing === 0 ? 0 : await nextNumbers(current, userId, "task", needing);
	const tasks = fresh.map((input) => ({
		taskId: input.taskId,
		number: keeps(input) ? (input.number as number) : next++,
		title: input.title,
		completed: false,
		completedAt: null,
		addedAt: input.addedAt || new Date().toISOString(),
		tagIds: [...new Set([...input.tagIds, ...(checklist.tagIds ?? [])])],
		urgent: input.urgent,
		important: input.important,
		trackerId: input.trackerId,
		linkedChecklistId: input.linkedChecklistId,
		userId,
		checklistId: listId,
	}));

	try {
		// Unordered, so one a retry overlapping the first try already wrote
		// does not stop the rest.
		await current.tasks.insertMany(tasks, { ordered: false });
	} catch (error) {
		if (!(error instanceof MongoBulkWriteError)) throw error;
		const failures = [error.writeErrors].flat();
		const isOnlyDuplicates =
			failures.length > 0 && failures.every((each) => each.code === 11000);
		if (!isOnlyDuplicates) throw error;
	}
}

/** A bulk write that failed only on things a first try already wrote. */
function isOnlyDuplicates(error: unknown): boolean {
	if (!(error instanceof MongoBulkWriteError)) return false;
	const failures = [error.writeErrors].flat();
	return failures.length > 0 && failures.every((each) => each.code === 11000);
}

/**
 * Make many checklists at once, each with its tasks — an outline pasted onto
 * the Groups screen — with one write for the checklists and one for the
 * tasks, rather than a request each; see `importGroupInputSchema`.
 *
 * Asked again after a dropped connection, what is already written is left as
 * it is and only the rest is added, as `createTasks` does.
 */
export async function importChecklists(
	userId: string,
	input: Pick<ImportGroupInput, "startDate" | "checklists">,
): Promise<void> {
	const current = await collections();

	const writtenLists = await current.checklists
		.find(
			{
				userId,
				checklistId: { $in: input.checklists.map((each) => each.checklistId) },
			},
			{ projection: { _id: 0, checklistId: 1 } },
		)
		.toArray();
	const isListWritten = new Set(writtenLists.map((each) => each.checklistId));
	const freshLists = input.checklists.filter(
		(each) => !isListWritten.has(each.checklistId),
	);

	if (freshLists.length > 0) {
		const now = new Date().toISOString();
		let next = await nextNumbers(
			current,
			userId,
			"checklist",
			freshLists.length,
		);
		try {
			await current.checklists.insertMany(
				freshLists.map((each) => ({
					checklistId: each.checklistId,
					number: next++,
					title: each.title,
					description: each.description,
					startDate: input.startDate,
					deadline: each.deadline ?? null,
					deadlineTime: each.deadlineTime ?? null,
					dailyWindow: null,
					tagIds: [],
					access: null,
					...(each.stages === undefined ? {} : { stages: each.stages }),
					...(each.urgent ? { urgent: true } : {}),
					...(each.important ? { important: true } : {}),
					createdAt: now,
					updatedAt: now,
					userId,
				})),
				{ ordered: false },
			);
		} catch (error) {
			if (!isOnlyDuplicates(error)) throw error;
		}
	}

	const inputs = input.checklists.flatMap((list) =>
		list.tasks.map((task) => ({ ...task, checklistId: list.checklistId })),
	);
	if (inputs.length === 0) return;

	const writtenTasks = await current.tasks
		.find(
			{ userId, taskId: { $in: inputs.map((task) => task.taskId) } },
			{ projection: { _id: 0, taskId: 1 } },
		)
		.toArray();
	const isTaskWritten = new Set(writtenTasks.map((task) => task.taskId));
	const fresh = inputs.filter((task) => !isTaskWritten.has(task.taskId));
	if (fresh.length === 0) return;

	let next = await nextNumbers(current, userId, "task", fresh.length);
	try {
		await current.tasks.insertMany(
			fresh.map((task) => ({
				taskId: task.taskId,
				number: next++,
				title: task.title,
				completed: false,
				completedAt: null,
				addedAt: task.addedAt || new Date().toISOString(),
				// New checklists carry no tags of their own to pass on.
				tagIds: [...new Set(task.tagIds)],
				urgent: task.urgent,
				important: task.important,
				trackerId: null,
				linkedChecklistId: null,
				userId,
				checklistId: task.checklistId,
			})),
			{ ordered: false },
		);
	} catch (error) {
		if (!isOnlyDuplicates(error)) throw error;
	}
}

/**
 * Refuse a task that would put a checklist inside itself.
 *
 * `parentId` is where the task is being added and `childId` the checklist it
 * would stand for. Following every checklist the child already holds, however
 * deep, must never lead back to the parent — or the parent would be waiting on
 * itself to finish, and never could.
 */
async function assertCanContain(
	current: Collections,
	userId: string,
	parentId: string,
	childId: string,
): Promise<void> {
	const seen = new Set<string>();
	let level = [childId];

	while (level.length > 0) {
		if (level.includes(parentId)) {
			throw new AppError(
				"invalid_data",
				"A checklist can't contain itself, even by way of another checklist.",
			);
		}

		for (const checklistId of level) seen.add(checklistId);

		const links = await current.tasks
			.find(
				{
					userId,
					checklistId: { $in: level },
					linkedChecklistId: { $ne: null },
				},
				{ projection: { _id: 0, linkedChecklistId: 1 } },
			)
			.toArray();

		level = [
			...new Set(
				links.flatMap((link) =>
					link.linkedChecklistId == null || seen.has(link.linkedChecklistId)
						? []
						: [link.linkedChecklistId],
				),
			),
		];
	}
}

export async function updateTask(
	userId: string,
	taskId: string,
	patch: TaskPatch,
): Promise<Task> {
	const current = await collections();
	const isMoving = patch.completed !== undefined || patch.stageId !== undefined;

	// Read only when the change needs something it cannot know by itself.
	const existing =
		!isMoving && patch.tagIds === undefined
			? null
			: await current.tasks.findOne(
					{ taskId, userId },
					{
						projection: {
							_id: 0,
							trackerId: 1,
							linkedChecklistId: 1,
							checklistId: 1,
							completed: 1,
							stageId: 1,
							dependsOn: 1,
							subtasks: 1,
						},
					},
				);

	// Its checklist's tags, which it keeps, and stages, which it moves along.
	const checklist = existing?.checklistId
		? await current.checklists.findOne(
				{ checklistId: existing.checklistId, userId },
				{ projection: { _id: 0, tagIds: 1, stages: 1 } },
			)
		: null;

	const changes = await editedFields(
		current,
		userId,
		existing,
		checklist,
		patch,
	);

	const next = await current.tasks.findOneAndUpdate(
		{ taskId, userId },
		{ $set: changes },
		{ returnDocument: "after", projection: TASK_FIELDS },
	);

	if (!next) throw new AppError("not_found", "That task no longer exists.");

	return next;
}

/** As much of a task as working out an edit to it needs. */
type TaskBeforeEdit = Pick<
	TaskDoc,
	| "trackerId"
	| "linkedChecklistId"
	| "checklistId"
	| "completed"
	| "stageId"
	| "dependsOn"
	| "subtasks"
>;

/**
 * What an edit writes to a task, given the task as it is — `null` where the
 * edit needed nothing of it — and its checklist; see `updateTask`. Refuses an
 * edit the task cannot take.
 */
async function editedFields(
	current: Collections,
	userId: string,
	existing: TaskBeforeEdit | null,
	checklist: Pick<Checklist, "tagIds" | "stages"> | null,
	patch: TaskPatch,
	/**
	 * What is not done among what it waits on, read already for a batch;
	 * see `undoneAmong`. Read here when left out.
	 */
	undone?: ReadonlyMap<string, string>,
): Promise<Partial<TaskDoc>> {
	const stages = checklistStages(checklist ?? {});
	const last = stages[stages.length - 1].stageId;

	/*
	 * Where it is going, and whether that is done.
	 *
	 * Reaching the last stage is completing it and leaving it is reopening it,
	 * so a stage and a tick are one thing said two ways: ticking moves it to the
	 * last stage, and unticking back one, to the stage before it — Review, not
	 * To do, when there is one.
	 */
	let moved: { stageId: string; completed: boolean } | null = null;
	if (patch.stageId !== undefined) {
		if (!stages.some((stage) => stage.stageId === patch.stageId)) {
			throw new AppError("invalid_data", "That stage no longer exists.");
		}
		moved = { stageId: patch.stageId, completed: patch.stageId === last };
	} else if (patch.completed !== undefined) {
		moved = {
			stageId: patch.completed ? last : stages[stages.length - 2].stageId,
			completed: patch.completed,
		};
	}

	/*
	 * A task standing for a tracker is not tickable.
	 *
	 * It is done when the tracker says so, and refusing the write here rather
	 * than only disabling the checkbox is what makes that true — a tick that
	 * arrived from a stale tab, a replayed request or a crafted one would
	 * otherwise leave the task claiming to be finished while the tracker says
	 * otherwise. Everything else about it edits normally, and it may move
	 * between the stages still open. The same goes for a task standing for
	 * another checklist.
	 */
	if (moved !== null && (patch.completed !== undefined || moved.completed)) {
		if (existing?.trackerId) {
			throw new AppError(
				"invalid_data",
				"This task follows a tracker. Record progress on the tracker instead.",
			);
		}

		if (existing?.linkedChecklistId) {
			throw new AppError(
				"invalid_data",
				"This task follows a checklist. Finish the tasks in that checklist instead.",
			);
		}
	}

	// Nothing is finished before its subtasks, or what it waits on; see
	// `Task.subtasks` and `Task.dependsOn`.
	if (moved?.completed && !existing?.completed) {
		// The list this edit leaves it with, where it writes one.
		const subtasks = subtasksBlocking(patch.subtasks ?? existing?.subtasks);
		if (subtasks !== null) throw new AppError("invalid_data", subtasks);

		const refs = existing?.dependsOn ?? [];
		const first = firstUndone(
			refs,
			undone ?? (await undoneAmong(current, userId, refs)),
		);
		if (first !== null) {
			throw new AppError(
				"invalid_data",
				`Can't complete this yet: ${first} is not done.`,
			);
		}
	}

	/*
	 * Finishing a task stamps the moment; reopening it clears it.
	 *
	 * Set here rather than sent by the browser so the timestamps a chart is
	 * drawn from all come off one clock. It is only touched when completion is
	 * part of the change, so editing a title never rewrites history.
	 */
	const stamps =
		moved !== null &&
		(patch.completed !== undefined || moved.completed !== existing?.completed);

	/*
	 * Moved to another stage, it goes to the top of that stage, as a task moved
	 * to another checklist does; see `moveTask`. A list reads newest first, so
	 * arriving counts as being added.
	 */
	const arrives =
		moved !== null &&
		existing !== null &&
		moved.stageId !== stageOf(existing, stages);

	/*
	 * A task keeps its checklist's tags however its own are edited. An edit
	 * sends the tags written in the title, and the checklist's are added back
	 * here, so no screen has to know which of a task's tags came from where.
	 */
	return {
		...patch,
		...(moved === null
			? {}
			: { stageId: moved.stageId, completed: moved.completed }),
		// Unless an undo sent the ones it had; see `TaskPatch`.
		...(stamps && moved !== null && patch.completedAt === undefined
			? { completedAt: moved.completed ? new Date().toISOString() : null }
			: {}),
		...(arrives && patch.addedAt === undefined
			? { addedAt: new Date().toISOString() }
			: {}),
		...(patch.tagIds === undefined
			? {}
			: {
					tagIds: [...new Set([...patch.tagIds, ...(checklist?.tagIds ?? [])])],
				}),
	};
}

/**
 * Move a task into another checklist.
 *
 * Its tags go with the move: the tags of the checklist it leaves come off,
 * except any its title writes as `#name` — see `untypedTags` — and the tags of
 * the checklist it joins go on, as they would for a task added there. It
 * starts at the new checklist's first stage, or its last if it is done, and at
 * the top of it: a list reads newest first, so arriving counts as being added.
 * A task standing for a checklist cannot be moved into that checklist, or into
 * one inside it; see `assertCanContain`. Parking it in the Backlog or taking
 * it out adds a line to its notes; see `notesAfterMove`.
 */
export async function moveTask(
	userId: string,
	taskId: string,
	checklistId: string,
	/** When it was moved, on the mover's clock; see `notesAfterMove`. */
	at?: { date: string; time: string },
): Promise<void> {
	const current = await collections();
	const target = await requireChecklist(current, userId, checklistId);

	const task = await current.tasks.findOne(
		{ taskId, userId },
		{
			projection: {
				_id: 0,
				title: 1,
				tagIds: 1,
				checklistId: 1,
				linkedChecklistId: 1,
				notes: 1,
			},
		},
	);
	if (!task) throw new AppError("not_found", "That task no longer exists.");

	// Already there is the outcome this asked for, not a failure.
	if (task.checklistId === checklistId) return;

	if (task.linkedChecklistId != null) {
		await assertCanContain(
			current,
			userId,
			checklistId,
			task.linkedChecklistId,
		);
	}

	const source =
		task.checklistId === null
			? null
			: await current.checklists.findOne(
					{ checklistId: task.checklistId, userId },
					{ projection: { _id: 0, tagIds: 1, title: 1, special: 1 } },
				);
	const leaving = leavingTags(source, target);

	const names =
		leaving.length === 0
			? []
			: await current.tags
					.find(
						{ userId, tagId: { $in: leaving } },
						{ projection: { _id: 0, tagId: 1, name: 1 } },
					)
					.toArray();

	await current.tasks.updateOne(
		{ taskId, userId },
		{
			$set: movedFields(
				task,
				source,
				target,
				new Map(names.map((tag) => [tag.tagId, tag.name])),
				at,
			),
		},
	);
}

/** As much of a checklist as a task moving out of it needs. */
type MoveSource = Pick<Checklist, "tagIds" | "title" | "special">;

/** The tags of the checklist a task leaves that the one it joins has not. */
function leavingTags(
	source: MoveSource | null,
	target: Checklist,
): Array<string> {
	const joining = target.tagIds ?? [];
	return (source?.tagIds ?? []).filter((tagId) => !joining.includes(tagId));
}

/**
 * What moving a task from `source` into `target` writes to it; see
 * `moveTask`. `names` holds the names of the tags it may lose, to tell which
 * its title writes; see `untypedTags`.
 */
function movedFields(
	task: Pick<TaskDoc, "title" | "tagIds" | "notes">,
	source: MoveSource | null,
	target: Checklist,
	names: ReadonlyMap<string, string>,
	at: { date: string; time: string } | undefined,
): Partial<TaskDoc> {
	const joining = target.tagIds ?? [];
	const dropped = untypedTags(task.title, leavingTags(source, target), names);
	const notes = notesAfterMove(task.notes, source, target, at);

	return {
		checklistId: target.checklistId,
		// Its stage was the old checklist's; see `stageOf`.
		stageId: null,
		addedAt: new Date().toISOString(),
		tagIds: [
			...new Set([
				...task.tagIds.filter((tagId) => !dropped.includes(tagId)),
				...joining,
			]),
		],
		...(notes === null ? {} : { notes }),
	};
}

/**
 * Many edits and moves at once — every task picked out; see `task.batch`.
 *
 * Each is worked out as `updateTask` and `moveTask` work out one, but from
 * three reads made for all of them — the tasks, the checklists they are in
 * and going to, and the names of the tags a move could take off — and written
 * in one go. A pick of fifty costs four round trips rather than a few hundred.
 *
 * A task's changes are worked out in the order they were made, each from the
 * task as the one before left it: parking one is an edit and then a move. A
 * task whose change is refused keeps what the ones before it made, and the
 * other tasks go ahead. What was made comes back, with the first refusal.
 */
export async function updateTasks(
	userId: string,
	changes: ReadonlyArray<BatchedChange>,
): Promise<{ made: Array<BatchedChange>; refusal: unknown }> {
	const made: Array<BatchedChange> = [];
	if (changes.length === 0) return { made, refusal: null };

	const current = await collections();
	const tasks = new Map(
		(
			await current.tasks
				.find(
					{
						userId,
						taskId: { $in: [...new Set(changes.map((each) => each.taskId))] },
					},
					{
						projection: {
							_id: 0,
							taskId: 1,
							title: 1,
							tagIds: 1,
							notes: 1,
							checklistId: 1,
							trackerId: 1,
							linkedChecklistId: 1,
							completed: 1,
							stageId: 1,
							dependsOn: 1,
							subtasks: 1,
						},
					},
				)
				.toArray()
		).map((task) => [task.taskId, task]),
	);

	const checklistIds = new Set([
		...[...tasks.values()].flatMap((task) => task.checklistId ?? []),
		...changes.flatMap((each) =>
			each.kind === "task.move" ? [each.checklistId] : [],
		),
	]);
	const checklists = new Map(
		(
			await current.checklists
				.find(
					{ userId, checklistId: { $in: [...checklistIds] } },
					{ projection: DOMAIN_FIELDS },
				)
				.toArray()
		).map((checklist) => [checklist.checklistId, checklist]),
	);

	// Any of their tags a move could take off; see `untypedTags`.
	const tagIds = changes.some((each) => each.kind === "task.move")
		? [
				...new Set(
					[...checklists.values()].flatMap((each) => each.tagIds ?? []),
				),
			]
		: [];
	const names = new Map(
		(tagIds.length === 0
			? []
			: await current.tags
					.find(
						{ userId, tagId: { $in: tagIds } },
						{ projection: { _id: 0, tagId: 1, name: 1 } },
					)
					.toArray()
		).map((tag) => [tag.tagId, tag.name]),
	);

	// What every task it may finish waits on, read once for all of them.
	const undone = await undoneAmong(
		current,
		userId,
		changes.flatMap((each) =>
			each.kind === "task.update" &&
			(each.patch.completed === true || each.patch.stageId !== undefined)
				? (tasks.get(each.taskId)?.dependsOn ?? [])
				: [],
		),
	);

	const writes = new Map<string, Partial<TaskDoc>>();
	const refused = new Set<string>();
	let refusal: unknown = null;

	for (const change of changes) {
		if (refused.has(change.taskId)) continue;

		try {
			const task = tasks.get(change.taskId);
			if (!task) throw new AppError("not_found", "That task no longer exists.");
			const source =
				task.checklistId === null
					? null
					: (checklists.get(task.checklistId) ?? null);

			let fields: Partial<TaskDoc>;
			if (change.kind === "task.update") {
				fields = await editedFields(
					current,
					userId,
					task,
					source,
					change.patch,
					undone,
				);
			} else {
				const target = checklists.get(change.checklistId);
				if (!target) {
					throw new AppError("not_found", "That checklist no longer exists.");
				}
				// Already there is the outcome this asked for, not a failure.
				if (task.checklistId === change.checklistId) continue;
				if (task.linkedChecklistId != null) {
					await assertCanContain(
						current,
						userId,
						change.checklistId,
						task.linkedChecklistId,
					);
				}
				fields = movedFields(task, source, target, names, change.at);
			}

			// The next change to it is worked out from the task as this leaves it.
			Object.assign(task, fields);
			writes.set(change.taskId, { ...writes.get(change.taskId), ...fields });
			made.push(change);
		} catch (error) {
			refused.add(change.taskId);
			if (refusal === null) refusal = error;
		}
	}

	if (writes.size > 0) {
		await current.tasks.bulkWrite(
			[...writes].map(([taskId, fields]) => ({
				updateOne: { filter: { taskId, userId }, update: { $set: fields } },
			})),
			{ ordered: false },
		);
	}

	return { made, refusal };
}

/** Delete a task. Already gone is the outcome this asked for, not a failure. */
export async function deleteTask(
	userId: string,
	taskId: string,
): Promise<void> {
	const current = await collections();
	await current.tasks.deleteOne({ taskId, userId });
	await clearDependencies(userId, "task", [taskId]);
}

/** Delete several tasks at once; any already gone are simply skipped. */
export async function deleteTasks(
	userId: string,
	taskIds: ReadonlyArray<string>,
): Promise<void> {
	const current = await collections();
	await current.tasks.deleteMany({ taskId: { $in: [...taskIds] }, userId });
	await clearDependencies(userId, "task", taskIds);
}
