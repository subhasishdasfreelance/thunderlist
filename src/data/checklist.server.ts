/**
 * Checklists and their tasks. Server only.
 *
 * A checklist is one document and each of its tasks is another, linked by
 * `checklistId`. Nothing is nested: a task is edited, moved between lists and
 * searched for on its own, and a document per task keeps every one of those a
 * single targeted write rather than a rewrite of the whole checklist.
 *
 * Every function here takes the owner first and names it in every filter. A
 * checklist or task id names a row; the owner is what decides whether it is
 * yours, and a row belonging to someone else is simply not found.
 */

import { AppError } from "#/lib/errors";
import {
	type Collections,
	collections,
	DOMAIN_FIELDS,
	type TaskDoc,
} from "#/lib/mongo/client.server";
import { trackerProgress } from "#/lib/progress";
import { parseInlineTags, sameTagName } from "#/lib/tags/inline-tags";
import { calculateChecklistProgress } from "#/lib/tasks/tasks";
import type {
	Checklist,
	ChecklistDetail,
	ChecklistSummary,
} from "#/schemas/checklist";
import type { DailyWindow } from "#/schemas/common";
import type { Task, TaskPatch } from "#/schemas/task";

/**
 * Just enough of a task to count progress with. `trackerId` is part of that: a
 * task following a tracker is done when the tracker is, not when it is ticked.
 * `linkedChecklistId` is the same for a task standing for another checklist.
 */
const PROGRESS_FIELDS = {
	_id: 0,
	checklistId: 1,
	completed: 1,
	trackerId: 1,
	linkedChecklistId: 1,
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
 * A checklist with its progress. Its pace is judged in the browser, on the
 * viewer's own clock, which this server does not know; see `usePace`.
 */
function summarise(
	checklist: Checklist,
	tasks: ReadonlyArray<Pick<Task, "completed">>,
): ChecklistSummary {
	return { ...checklist, progress: calculateChecklistProgress(tasks) };
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every checklist with its progress.
 *
 * Two reads, whatever the number of checklists: the checklists themselves, and
 * the completed flag of every task grouped by the checklist it belongs to. A
 * third reads the trackers those tasks follow, when any do.
 */
export async function listChecklists(
	userId: string,
): Promise<Array<ChecklistSummary>> {
	const current = await collections();

	const [checklists, stored] = await Promise.all([
		current.checklists
			.find({ userId }, { projection: DOMAIN_FIELDS })
			.toArray(),
		current.tasks.find({ userId }, { projection: PROGRESS_FIELDS }).toArray(),
	]);

	// Counted the same way the checklist itself counts them, or a task finished
	// by its tracker shows as done inside the checklist and not on its card.
	const tasks = await withTrackedCompletion(current, userId, stored);

	const byChecklist = new Map<string, Array<Pick<Task, "completed">>>();
	for (const task of tasks) {
		// A task that belongs to no checklist counts towards none of them.
		if (task.checklistId === null) continue;

		const existing = byChecklist.get(task.checklistId);
		if (existing) existing.push(task);
		else byChecklist.set(task.checklistId, [task]);
	}

	return checklists.map((checklist) =>
		summarise(checklist, byChecklist.get(checklist.checklistId) ?? []),
	);
}

/** A task with the checklist it belongs to, if any. */
export type TaskWithChecklist = { task: Task; checklistId: string | null };

/**
 * Tasks by id, in one read.
 *
 * Today and the Backlog reference tasks by id and nothing else, so this asks
 * for exactly what they name — including tasks that belong to no checklist at
 * all, which have nothing else to be found by.
 */
export async function readTasksByIds(
	userId: string,
	taskIds: ReadonlyArray<string>,
): Promise<Map<string, TaskWithChecklist>> {
	const byId = new Map<string, TaskWithChecklist>();
	if (taskIds.length === 0) return byId;

	const current = await collections();
	const rows = await current.tasks
		.find({ userId, taskId: { $in: [...taskIds] } })
		.project<TaskDoc>(DOMAIN_FIELDS)
		.toArray();

	for (const { checklistId, ...task } of rows) {
		byId.set(task.taskId, { task, checklistId });
	}

	return byId;
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

export async function getChecklist(
	userId: string,
	checklistId: string,
): Promise<ChecklistDetail> {
	const current = await collections();
	const checklist = await requireChecklist(current, userId, checklistId);

	const tasks = await readChecklistTasks(current, userId, checklistId);

	// Every task is counted, but only the open ones come back: the finished
	// ones are read on their own once the screen has settled.
	return {
		...summarise(checklist, tasks),
		tasks: tasks.filter((task) => !task.completed),
	};
}

/**
 * The finished tasks of a checklist, read after the rest of its screen.
 *
 * They are the long tail of a list and nobody is waiting on them, so they
 * are not part of `getChecklist`; see `useWhenIdle`.
 */
export async function getChecklistCompleted(
	userId: string,
	checklistId: string,
): Promise<Array<Task>> {
	const current = await collections();
	await requireChecklist(current, userId, checklistId);

	const tasks = await readChecklistTasks(current, userId, checklistId);
	return tasks.filter((task) => task.completed);
}

/**
 * Every task in a checklist, with completion worked out for the ones that
 * follow a tracker or another checklist — which is why even the finished ones
 * alone cannot be picked out by a query.
 */
async function readChecklistTasks(
	current: Collections,
	userId: string,
	checklistId: string,
): Promise<Array<Task>> {
	const stored = await current.tasks
		.find({ checklistId, userId }, { projection: TASK_FIELDS })
		.toArray();

	return withTrackedCompletion(current, userId, stored);
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
		createdAt: now,
		updatedAt: now,
	};

	await current.checklists.insertOne({ ...checklist, userId });

	return checklist;
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
	const added = after.filter((tagId) => !before.includes(tagId));
	const removed = before.filter((tagId) => !after.includes(tagId));

	if (added.length > 0) {
		await current.tasks.updateMany(
			{ userId, checklistId },
			{ $addToSet: { tagIds: { $each: added } } },
		);
	}

	if (removed.length === 0) return;

	const [tags, tasks] = await Promise.all([
		current.tags
			.find(
				{ userId, tagId: { $in: removed } },
				{ projection: { _id: 0, tagId: 1, name: 1 } },
			)
			.toArray(),
		current.tasks
			.find(
				{ userId, checklistId, tagIds: { $in: removed } },
				{ projection: { _id: 0, taskId: 1, title: 1 } },
			)
			.toArray(),
	]);

	if (tasks.length === 0) return;

	const names = new Map(tags.map((tag) => [tag.tagId, tag.name]));

	await current.tasks.bulkWrite(
		tasks.map((task) => {
			const typed = parseInlineTags(task.title).tagNames;
			const dropped = removed.filter((tagId) => {
				const name = names.get(tagId);
				return (
					name === undefined ||
					!typed.some((typedName) => sameTagName(typedName, name))
				);
			});

			return {
				updateOne: {
					filter: { taskId: task.taskId, userId },
					update: { $pull: { tagIds: { $in: dropped } } },
				},
			};
		}),
	);
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
	},
): Promise<Checklist> {
	const current = await collections();

	/*
	 * A checklist's tags are carried by its tasks, so changing them changes the
	 * tasks too. The tasks go first: if this fails part-way the checklist still
	 * has its old tags, and trying again works out the same difference and
	 * finishes the job.
	 */
	if (patch.tagIds !== undefined) {
		const before = await requireChecklist(current, userId, checklistId);
		await retagTasks(
			current,
			userId,
			checklistId,
			before.tagIds ?? [],
			patch.tagIds,
		);
	}

	const next = await current.checklists.findOneAndUpdate(
		{ checklistId, userId },
		{ $set: { ...patch, updatedAt: new Date().toISOString() } },
		{ returnDocument: "after", projection: DOMAIN_FIELDS },
	);

	if (!next) {
		throw new AppError("not_found", "That checklist no longer exists.");
	}

	return next;
}

/**
 * Remove a checklist and the tasks in it.
 *
 * The tasks go first: a checklist left holding tasks is still usable, whereas
 * tasks whose checklist has gone belong to nothing and cannot be reached.
 */
export async function deleteChecklist(
	userId: string,
	checklistId: string,
): Promise<void> {
	const current = await collections();

	await current.tasks.deleteMany({ checklistId, userId });
	await current.checklists.deleteOne({ checklistId, userId });
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export async function createTask(
	userId: string,
	input: {
		checklistId: string | null;
		taskId: string;
		title: string;
		addedAt: string;
		tagIds: Array<string>;
		urgent: boolean;
		important: boolean;
		/** A tracker this task stands for; see `taskSchema`. */
		trackerId?: string | null;
		/** A checklist this task stands for; see `taskSchema`. */
		linkedChecklistId?: string | null;
	},
): Promise<Task> {
	const current = await collections();
	// A task can belong to no checklist; one that names a checklist must name a
	// real one, and one of this user's — which is what stops a task being filed
	// into a stranger's checklist by guessing its id.
	const checklist =
		input.checklistId === null
			? null
			: await requireChecklist(current, userId, input.checklistId);

	const existing = await current.tasks.findOne(
		{ taskId: input.taskId, userId },
		{ projection: TASK_FIELDS },
	);
	if (existing) return existing;

	const linkedChecklistId = input.linkedChecklistId ?? null;
	if (linkedChecklistId !== null) {
		// The same rule as the checklist it lives in: real, and this user's.
		await requireChecklist(current, userId, linkedChecklistId);
		if (input.checklistId !== null) {
			await assertCanContain(
				current,
				userId,
				input.checklistId,
				linkedChecklistId,
			);
		}
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
		tagIds: [...new Set([...input.tagIds, ...(checklist?.tagIds ?? [])])],
		urgent: input.urgent,
		important: input.important,
		trackerId: input.trackerId ?? null,
		linkedChecklistId,
	};

	await current.tasks.insertOne({
		...task,
		userId,
		checklistId: input.checklistId,
	});

	return task;
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

	/*
	 * Ticking a task stamps the moment; un-ticking clears it.
	 *
	 * Set here rather than sent by the browser so the timestamps a chart is
	 * drawn from all come off one clock. It is only touched when `completed` is
	 * part of the change, so editing a title never rewrites history.
	 */
	const stamped =
		patch.completed === undefined
			? patch
			: {
					...patch,
					completedAt: patch.completed ? new Date().toISOString() : null,
				};

	// Read only when the change needs something it cannot know by itself.
	const existing =
		patch.completed === undefined && patch.tagIds === undefined
			? null
			: await current.tasks.findOne(
					{ taskId, userId },
					{
						projection: {
							_id: 0,
							trackerId: 1,
							linkedChecklistId: 1,
							checklistId: 1,
						},
					},
				);

	/*
	 * A task standing for a tracker is not tickable.
	 *
	 * It is done when the tracker says so, and refusing the write here rather
	 * than only disabling the checkbox is what makes that true — a tick that
	 * arrived from a stale tab, a replayed request or a crafted one would
	 * otherwise leave the task claiming to be finished while the tracker says
	 * otherwise. Everything else about it edits normally. The same goes for a
	 * task standing for another checklist.
	 */
	if (patch.completed !== undefined) {
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

	/*
	 * A task keeps its checklist's tags however its own are edited. An edit
	 * sends the tags written in the title, and the checklist's are added back
	 * here, so no screen has to know which of a task's tags came from where.
	 */
	const inherited =
		patch.tagIds === undefined || !existing?.checklistId
			? []
			: ((
					await current.checklists.findOne(
						{ checklistId: existing.checklistId, userId },
						{ projection: { _id: 0, tagIds: 1 } },
					)
				)?.tagIds ?? []);

	const changes =
		patch.tagIds === undefined
			? stamped
			: { ...stamped, tagIds: [...new Set([...patch.tagIds, ...inherited])] };

	const next = await current.tasks.findOneAndUpdate(
		{ taskId, userId },
		{ $set: changes },
		{ returnDocument: "after", projection: TASK_FIELDS },
	);

	if (!next) throw new AppError("not_found", "That task no longer exists.");

	return next;
}

/** Delete a task. Already gone is the outcome this asked for, not a failure. */
export async function deleteTask(
	userId: string,
	taskId: string,
): Promise<void> {
	const current = await collections();
	await current.tasks.deleteOne({ taskId, userId });
}

/**
 * Strip a tag from every task carrying it.
 *
 * Called when a tag is deleted. Tasks reference tags by id, so leaving the id
 * behind would show a task tagged with something that no longer exists.
 */
export async function removeTagFromTasks(
	userId: string,
	tagId: string,
): Promise<number> {
	const current = await collections();

	const result = await current.tasks.updateMany(
		{ userId, tagIds: tagId },
		{ $pull: { tagIds: tagId } },
	);

	return result.modifiedCount;
}
