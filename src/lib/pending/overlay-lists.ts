/**
 * Showing queued Today and Backlog changes before they reach the database.
 *
 * The two lists are projected together because moving a task between them is
 * one action to the user and two changes to the stored references.
 */

import type { TaskLists } from "#/data/task-list.server";
import type { QueuedChange } from "#/schemas/pending";
import type { TaskListName, TaskRefEntry } from "#/schemas/task-list";

const OTHER: Record<TaskListName, TaskListName> = {
	today: "backlog",
	backlog: "today",
};

/**
 * Build a row for a task the list has not fetched.
 *
 * A queued `ref.add` points at a task by id, and the list it is being added to
 * has no way to resolve that id until the batch is applied. The screen that
 * queued the change did know it, and recorded what is needed to draw the row.
 */
function entryFor(
	queued: QueuedChange,
	change: Extract<QueuedChange["change"], { kind: "ref.add" }>,
): TaskRefEntry {
	const preview = queued.preview;

	return {
		item: {
			itemId: change.itemId,
			checklistId: change.checklistId,
			taskId: change.taskId,
			sortOrder: change.sortOrder,
			addedAt: queued.queuedAt,
		},
		list: change.list,
		checklistTitle: preview?.checklistTitle ?? null,
		task: preview
			? {
					taskId: change.taskId,
					title: preview.title,
					completed: preview.completed,
					addedAt: queued.queuedAt,
					tagIds: preview.tagIds,
					urgent: preview.urgent,
					important: preview.important,
				}
			: null,
	};
}

/** Swap an entry with its neighbour, or leave the list alone at either end. */
function nudge(
	entries: ReadonlyArray<TaskRefEntry>,
	itemId: string,
	direction: "up" | "down",
): Array<TaskRefEntry> {
	const index = entries.findIndex((entry) => entry.item.itemId === itemId);
	const target = direction === "up" ? index - 1 : index + 1;
	if (index === -1 || target < 0 || target >= entries.length)
		return [...entries];

	const next = [...entries];
	[next[index], next[target]] = [next[target], next[index]];
	return next;
}

export function overlayTaskLists(
	lists: TaskLists,
	queued: ReadonlyArray<QueuedChange>,
): TaskLists {
	let result: TaskLists = {
		today: [...lists.today],
		backlog: [...lists.backlog],
	};

	const mapAll = (
		update: (entry: TaskRefEntry) => TaskRefEntry | null,
	): void => {
		result = {
			today: result.today.flatMap((entry) => update(entry) ?? []),
			backlog: result.backlog.flatMap((entry) => update(entry) ?? []),
		};
	};

	for (const entry of queued) {
		const { change } = entry;

		switch (change.kind) {
			case "ref.add": {
				const isSameTask = (candidate: TaskRefEntry) =>
					candidate.item.checklistId === change.checklistId &&
					candidate.item.taskId === change.taskId;

				// A task is planned or parked, never both, so adding to one list takes
				// it out of the other exactly as the server will.
				result = {
					...result,
					[OTHER[change.list]]: result[OTHER[change.list]].filter(
						(candidate) => !isSameTask(candidate),
					),
				};

				if (!result[change.list].some(isSameTask)) {
					result = {
						...result,
						[change.list]: [...result[change.list], entryFor(entry, change)],
					};
				}
				break;
			}

			case "ref.remove":
				result = {
					...result,
					[change.list]: result[change.list].filter(
						(candidate) => candidate.item.itemId !== change.itemId,
					),
				};
				break;

			case "ref.move":
				result = {
					...result,
					[change.list]: nudge(
						result[change.list],
						change.itemId,
						change.direction,
					),
				};
				break;

			case "task.update":
				mapAll((candidate) =>
					candidate.task &&
					candidate.item.checklistId === change.checklistId &&
					candidate.item.taskId === change.taskId
						? { ...candidate, task: { ...candidate.task, ...change.patch } }
						: candidate,
				);
				break;

			case "task.delete":
				mapAll((candidate) =>
					candidate.item.checklistId === change.checklistId &&
					candidate.item.taskId === change.taskId
						? null
						: candidate,
				);
				break;

			case "checklist.delete":
				mapAll((candidate) =>
					candidate.item.checklistId === change.checklistId ? null : candidate,
				);
				break;

			case "checklist.update":
				if (change.patch.title !== undefined) {
					const title = change.patch.title;
					mapAll((candidate) =>
						candidate.item.checklistId === change.checklistId
							? { ...candidate, checklistTitle: title }
							: candidate,
					);
				}
				break;

			default:
				break;
		}
	}

	return result;
}
