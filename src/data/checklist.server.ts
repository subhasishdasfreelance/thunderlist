/**
 * Checklists and their tasks. Server only.
 *
 * A checklist is one document and each of its tasks is another, linked by
 * `checklistId`. Nothing is nested: a task is edited, moved between lists and
 * searched for on its own, and a document per task keeps every one of those a
 * single targeted write rather than a rewrite of the whole checklist.
 */

import { AppError } from "#/lib/errors";
import {
	type Collections,
	collections,
	DOMAIN_FIELDS,
	type TaskDoc,
} from "#/lib/mongo/client.server";
import { paceStatus } from "#/lib/progress";
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
	checklistId: string,
): Promise<Checklist> {
	const checklist = await current.checklists.findOne(
		{ checklistId },
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
export async function listChecklists(): Promise<Array<ChecklistSummary>> {
	const current = await collections();

	const [checklists, tasks] = await Promise.all([
		current.checklists.find({}, { projection: DOMAIN_FIELDS }).toArray(),
		current.tasks.find({}, { projection: PROGRESS_FIELDS }).toArray(),
	]);

	const byChecklist = new Map<string, Array<Pick<Task, "completed">>>();
	for (const task of tasks) {
		const existing = byChecklist.get(task.checklistId);
		if (existing) existing.push(task);
		else byChecklist.set(task.checklistId, [task]);
	}

	return checklists.map((checklist) =>
		summarise(checklist, byChecklist.get(checklist.checklistId) ?? []),
	);
}

/** Tasks for several checklists in one read, used by Today and search. */
export async function readTasksByChecklist(
	checklistIds: ReadonlyArray<string>,
): Promise<Map<string, Array<Task>>> {
	const byChecklist = new Map<string, Array<Task>>();
	if (checklistIds.length === 0) return byChecklist;

	const current = await collections();
	const tasks = await current.tasks
		.find({ checklistId: { $in: [...checklistIds] } })
		.project<TaskDoc>(DOMAIN_FIELDS)
		.toArray();

	for (const { checklistId, ...task } of tasks) {
		const existing = byChecklist.get(checklistId);
		if (existing) existing.push(task);
		else byChecklist.set(checklistId, [task]);
	}

	return byChecklist;
}

export async function getChecklist(
	checklistId: string,
): Promise<ChecklistDetail> {
	const current = await collections();
	const checklist = await requireChecklist(current, checklistId);

	const tasks = await current.tasks
		.find({ checklistId }, { projection: TASK_FIELDS })
		.toArray();

	return { ...summarise(checklist, tasks), tasks };
}

/* -------------------------------------------------------------------------- */
/* Checklist lifecycle                                                        */
/* -------------------------------------------------------------------------- */

export async function createChecklist(input: {
	checklistId: string;
	title: string;
	description: string;
	startDate: string;
	deadline: string | null;
}): Promise<Checklist> {
	const current = await collections();

	// Replaying a change that already went in must not create a second copy; see
	// `applyChanges`, which can retry after a partial failure.
	const existing = await current.checklists.findOne(
		{ checklistId: input.checklistId },
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

	await current.checklists.insertOne(checklist);

	return checklist;
}

export async function updateChecklist(
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
		{ checklistId },
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
export async function deleteChecklist(checklistId: string): Promise<void> {
	const current = await collections();

	await current.tasks.deleteMany({ checklistId });
	await current.checklists.deleteOne({ checklistId });
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export async function createTask(input: {
	checklistId: string;
	taskId: string;
	title: string;
	addedAt: string;
	tagIds: Array<string>;
	urgent: boolean;
	important: boolean;
}): Promise<Task> {
	const current = await collections();
	await requireChecklist(current, input.checklistId);

	const existing = await current.tasks.findOne(
		{ taskId: input.taskId },
		{ projection: TASK_FIELDS },
	);
	if (existing) return existing;

	const task: Task = {
		taskId: input.taskId,
		title: input.title,
		completed: false,
		// The client stamped this when the task was queued, which is the moment
		// the user actually added it and the order they saw it in.
		addedAt: input.addedAt || new Date().toISOString(),
		tagIds: input.tagIds,
		urgent: input.urgent,
		important: input.important,
	};

	await current.tasks.insertOne({ ...task, checklistId: input.checklistId });

	return task;
}

export async function updateTask(
	checklistId: string,
	taskId: string,
	patch: TaskPatch,
): Promise<Task> {
	const current = await collections();

	const next = await current.tasks.findOneAndUpdate(
		{ taskId, checklistId },
		{ $set: patch },
		{ returnDocument: "after", projection: TASK_FIELDS },
	);

	if (!next) throw new AppError("not_found", "That task no longer exists.");

	return next;
}

/**
 * Delete a task.
 *
 * Returns the id that was removed so callers can clear any Today or Backlog
 * reference pointing at it.
 */
export async function deleteTask(
	checklistId: string,
	taskId: string,
): Promise<Array<string>> {
	const current = await collections();

	// Already gone is the outcome this asked for, not a failure.
	await current.tasks.deleteOne({ taskId, checklistId });

	return [taskId];
}

/**
 * Strip a tag from every task carrying it.
 *
 * Called when a tag is deleted. Tasks reference tags by id, so leaving the id
 * behind would show a task tagged with something that no longer exists.
 */
export async function removeTagFromTasks(tagId: string): Promise<number> {
	const current = await collections();

	const result = await current.tasks.updateMany(
		{ tagIds: tagId },
		{ $pull: { tagIds: tagId } },
	);

	return result.modifiedCount;
}
