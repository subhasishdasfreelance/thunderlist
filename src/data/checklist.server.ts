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
import { paceStatus, trackerProgress } from "#/lib/progress";
import { calculateChecklistProgress } from "#/lib/tasks/tasks";
import type {
	Checklist,
	ChecklistDetail,
	ChecklistSummary,
} from "#/schemas/checklist";
import type { Task, TaskPatch } from "#/schemas/task";

/** Just enough of a task to count progress with. */
const PROGRESS_FIELDS = { _id: 0, checklistId: 1, completed: 1 } as const;

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

function summarise(
	checklist: Checklist,
	tasks: ReadonlyArray<Pick<Task, "completed">>,
): ChecklistSummary {
	const progress = calculateChecklistProgress(tasks);

	return {
		...checklist,
		progress,
		status:
			progress.total === 0
				? null
				: paceStatus({
						startDate: checklist.startDate,
						deadline: checklist.deadline,
						fractionComplete: progress.completed / progress.total,
					}),
	};
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every checklist with its progress.
 *
 * Two reads, whatever the number of checklists: the checklists themselves, and
 * the completed flag of every task grouped by the checklist it belongs to.
 */
export async function listChecklists(
	userId: string,
): Promise<Array<ChecklistSummary>> {
	const current = await collections();

	const [checklists, tasks] = await Promise.all([
		current.checklists
			.find({ userId }, { projection: DOMAIN_FIELDS })
			.toArray(),
		current.tasks.find({ userId }, { projection: PROGRESS_FIELDS }).toArray(),
	]);

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
 * Fill in the completion of any task that stands for a tracker.
 *
 * Worked out on every read rather than written to the task, because the thing
 * it depends on moves on its own: recording progress would otherwise have to
 * remember to go and tick a task somewhere else, and the day it forgot, the
 * list would be lying. Ordinary tasks are handed back untouched, and a set with
 * none costs no query at all.
 */
export async function withTrackedCompletion(
	current: Collections,
	userId: string,
	tasks: ReadonlyArray<Task>,
): Promise<Array<Task>> {
	const trackerIds = [
		...new Set(
			tasks.flatMap((task) =>
				task.trackerId === null ? [] : [task.trackerId],
			),
		),
	];

	if (trackerIds.length === 0) return [...tasks];

	const trackers = await current.trackers
		.find(
			{ userId, trackerId: { $in: trackerIds } },
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

	const reached = new Map(
		trackers.map((tracker) => [
			tracker.trackerId,
			trackerProgress(
				tracker.currentValue,
				tracker.targetValue,
				tracker.startValue,
			).percent >= 100,
		]),
	);

	return tasks.map((task) =>
		task.trackerId === null
			? task
			: { ...task, completed: reached.get(task.trackerId) ?? false },
	);
}

export async function getChecklist(
	userId: string,
	checklistId: string,
): Promise<ChecklistDetail> {
	const current = await collections();
	const checklist = await requireChecklist(current, userId, checklistId);

	const stored = await current.tasks
		.find({ checklistId, userId }, { projection: TASK_FIELDS })
		.toArray();

	const tasks = await withTrackedCompletion(current, userId, stored);

	return { ...summarise(checklist, tasks), tasks };
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
		createdAt: now,
		updatedAt: now,
	};

	await current.checklists.insertOne({ ...checklist, userId });

	return checklist;
}

export async function updateChecklist(
	userId: string,
	checklistId: string,
	patch: {
		title?: string;
		description?: string;
		startDate?: string;
		deadline?: string | null;
	},
): Promise<Checklist> {
	const current = await collections();

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

/** The ids of the tasks in a checklist, so their references can be cleared. */
export async function readChecklistTaskIds(
	userId: string,
	checklistId: string,
): Promise<Array<string>> {
	const current = await collections();
	const rows = await current.tasks
		.find({ checklistId, userId }, { projection: { _id: 0, taskId: 1 } })
		.toArray();

	return rows.map((row) => row.taskId);
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
	},
): Promise<Task> {
	const current = await collections();
	// A task can belong to no checklist; one that names a checklist must name a
	// real one, and one of this user's — which is what stops a task being filed
	// into a stranger's checklist by guessing its id.
	if (input.checklistId !== null) {
		await requireChecklist(current, userId, input.checklistId);
	}

	const existing = await current.tasks.findOne(
		{ taskId: input.taskId, userId },
		{ projection: TASK_FIELDS },
	);
	if (existing) return existing;

	const task: Task = {
		taskId: input.taskId,
		title: input.title,
		completed: false,
		completedAt: null,
		// The client stamped this when the task was queued, which is the moment
		// the user actually added it and the order they saw it in.
		addedAt: input.addedAt || new Date().toISOString(),
		tagIds: input.tagIds,
		urgent: input.urgent,
		important: input.important,
		trackerId: input.trackerId ?? null,
	};

	await current.tasks.insertOne({
		...task,
		userId,
		checklistId: input.checklistId,
	});

	return task;
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

	/*
	 * A task standing for a tracker is not tickable.
	 *
	 * It is done when the tracker says so, and refusing the write here rather
	 * than only disabling the checkbox is what makes that true — a tick that
	 * arrived from a stale tab, a replayed request or a crafted one would
	 * otherwise leave the task claiming to be finished while the tracker says
	 * otherwise. Everything else about it edits normally.
	 */
	if (patch.completed !== undefined) {
		const existing = await current.tasks.findOne(
			{ taskId, userId },
			{ projection: { _id: 0, trackerId: 1 } },
		);

		if (existing?.trackerId) {
			throw new AppError(
				"invalid_data",
				"This task follows a tracker. Record progress on the tracker instead.",
			);
		}
	}

	const next = await current.tasks.findOneAndUpdate(
		{ taskId, userId },
		{ $set: stamped },
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
