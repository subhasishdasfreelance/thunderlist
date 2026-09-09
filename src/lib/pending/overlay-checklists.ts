/**
 * Showing queued checklist and task edits before they reach the database.
 *
 * Nothing is written until the user confirms a batch, so every screen renders
 * what the server returned with the queue laid over the top. These are pure
 * projections: they never mutate their input and never talk to the network.
 */

import { paceStatus } from "#/lib/progress";
import { calculateChecklistProgress } from "#/lib/tasks/tasks";
import type { ChecklistDetail, ChecklistSummary } from "#/schemas/checklist";
import type { QueuedChange } from "#/schemas/pending";
import type { Task } from "#/schemas/task";

function newTask(
	change: Extract<QueuedChange["change"], { kind: "task.create" }>,
): Task {
	return {
		taskId: change.taskId,
		title: change.title,
		completed: false,
		addedAt: change.addedAt,
		tagIds: change.tagIds,
		urgent: change.urgent,
		important: change.important,
	};
}

function summaryFor(
	change: Extract<QueuedChange["change"], { kind: "checklist.create" }>,
	at: string,
): ChecklistSummary {
	return {
		checklistId: change.checklistId,
		title: change.title,
		description: change.description,
		startDate: change.startDate,
		deadline: change.deadline,
		createdAt: at,
		updatedAt: at,
		// The checklist is created when the batch is applied; nothing reads this
		// name before then.
		progress: { total: 0, completed: 0, percent: 0 },
		status: null,
	};
}

function withProgress(
	checklist: ChecklistSummary,
	total: number,
	completed: number,
): ChecklistSummary {
	const safeTotal = Math.max(0, total);
	const safeCompleted = Math.min(Math.max(0, completed), safeTotal);

	return {
		...checklist,
		progress: {
			total: safeTotal,
			completed: safeCompleted,
			percent:
				safeTotal === 0 ? 0 : Math.round((safeCompleted / safeTotal) * 100),
		},
	};
}

/**
 * The checklist list with the queue applied.
 *
 * The list carries counts rather than tasks, so a queued task change is
 * reflected by adjusting those counts. Deleting a task that was already ticked
 * off can leave the completed count one high until the batch is applied, which
 * is why both figures are clamped: a pending list is a preview, and the next
 * read from the database is the correction.
 */
export function overlayChecklists(
	checklists: ReadonlyArray<ChecklistSummary>,
	queued: ReadonlyArray<QueuedChange>,
): Array<ChecklistSummary> {
	let result = [...checklists];

	const replace = (
		checklistId: string,
		update: (checklist: ChecklistSummary) => ChecklistSummary,
	) => {
		result = result.map((checklist) =>
			checklist.checklistId === checklistId ? update(checklist) : checklist,
		);
	};

	for (const { change, queuedAt } of queued) {
		switch (change.kind) {
			case "checklist.create":
				result = [...result, summaryFor(change, queuedAt)];
				break;

			case "checklist.update":
				replace(change.checklistId, (checklist) => ({
					...checklist,
					...change.patch,
				}));
				break;

			case "checklist.delete":
				result = result.filter(
					(checklist) => checklist.checklistId !== change.checklistId,
				);
				break;

			case "task.create":
				replace(change.checklistId, (checklist) =>
					withProgress(
						checklist,
						checklist.progress.total + 1,
						checklist.progress.completed,
					),
				);
				break;

			case "task.delete":
				replace(change.checklistId, (checklist) =>
					withProgress(
						checklist,
						checklist.progress.total - 1,
						checklist.progress.completed,
					),
				);
				break;

			case "task.update":
				if (change.patch.completed !== undefined) {
					const step = change.patch.completed ? 1 : -1;
					replace(change.checklistId, (checklist) =>
						withProgress(
							checklist,
							checklist.progress.total,
							checklist.progress.completed + step,
						),
					);
				}
				break;

			default:
				break;
		}
	}

	return result.map((checklist) =>
		checklist.progress.total === 0
			? { ...checklist, status: null }
			: {
					...checklist,
					status: paceStatus({
						startDate: checklist.startDate,
						deadline: checklist.deadline,
						fractionComplete:
							checklist.progress.completed / checklist.progress.total,
					}),
				},
	);
}

/**
 * One checklist with the queue applied.
 *
 * Unlike the list, this has every task, so progress is recomputed from them
 * rather than adjusted, and the result is exactly what the database will hold
 * once the batch goes in.
 */
export function overlayChecklistDetail(
	detail: ChecklistDetail,
	queued: ReadonlyArray<QueuedChange>,
): ChecklistDetail {
	let checklist = detail;
	let tasks = [...detail.tasks];

	for (const { change } of queued) {
		switch (change.kind) {
			case "checklist.update":
				if (change.checklistId === checklist.checklistId) {
					checklist = { ...checklist, ...change.patch };
				}
				break;

			case "task.create":
				if (change.checklistId === checklist.checklistId) {
					tasks = [...tasks, newTask(change)];
				}
				break;

			case "task.update":
				if (change.checklistId === checklist.checklistId) {
					tasks = tasks.map((task) =>
						task.taskId === change.taskId ? { ...task, ...change.patch } : task,
					);
				}
				break;

			case "task.delete":
				if (change.checklistId === checklist.checklistId) {
					tasks = tasks.filter((task) => task.taskId !== change.taskId);
				}
				break;

			default:
				break;
		}
	}

	const progress = calculateChecklistProgress(tasks);

	return {
		...checklist,
		tasks,
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

/**
 * A checklist that exists only in the queue.
 *
 * Creating a checklist navigates straight into it so tasks can be added, but
 * the database has never heard of it, so there is nothing to fetch and lay the
 * queue over. This builds the whole thing from the queue instead, and returns
 * `null` when the id really is unknown.
 */
export function pendingChecklistDetail(
	checklistId: string,
	queued: ReadonlyArray<QueuedChange>,
): ChecklistDetail | null {
	const created = queued.find(
		(entry) =>
			entry.change.kind === "checklist.create" &&
			entry.change.checklistId === checklistId,
	);

	if (!created || created.change.kind !== "checklist.create") return null;

	return overlayChecklistDetail(
		{ ...summaryFor(created.change, created.queuedAt), tasks: [] },
		queued,
	);
}
