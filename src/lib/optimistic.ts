/**
 * Showing a change before the server has confirmed it.
 *
 * A tick, a flag, a task typed and entered — these are things the user has
 * already decided. Waiting a round trip to redraw them makes the app feel like
 * it is thinking about whether to agree, so the caches are patched immediately
 * and the request goes out behind it.
 *
 * Only the changes made *while reading a list* are patched here: ticking,
 * flagging, adding, removing, moving between lists. The rest — editing a
 * checklist, creating a tracker — happen in a dialog that closes anyway, where
 * a moment's wait costs nothing and a second copy of the write logic would.
 * Creating a checklist is the exception, because the app goes straight into
 * the new one; see below.
 *
 * Every patch is a guess. It is replaced by the server's answer on the next
 * refetch, and thrown away if the request fails, so a wrong guess is visible
 * for one round trip and never persists.
 */

import type { QueryClient } from "@tanstack/react-query";
import { calculateChecklistProgress } from "#/lib/tasks/tasks";
import { queryKeys } from "#/queries/keys";
import type { Change } from "#/schemas/change";
import type { ChecklistDetail, ChecklistSummary } from "#/schemas/checklist";
import type { TagDetail, TagTaskEntry } from "#/schemas/tag";
import type { Task } from "#/schemas/task";
import type { TaskListName, TaskRefEntry } from "#/schemas/task-list";

type TaskLists = Record<TaskListName, Array<TaskRefEntry>>;

/** Recount a checklist's progress after its tasks changed underneath it. */
function recount(detail: ChecklistDetail): ChecklistDetail {
	const total = detail.tasks.length;
	const completed = detail.tasks.filter((task) => task.completed).length;

	return {
		...detail,
		progress: {
			total,
			completed,
			percent: total === 0 ? 0 : Math.round((completed / total) * 100),
		},
	};
}

/**
 * Apply `patch` to every checklist detail currently in the cache.
 *
 * The keys are walked rather than matched as a prefix: `["checklists"]` is both
 * the summary list's own key and the first segment of every detail key, so a
 * prefix match hands back the summaries — an array, with no `tasks` on it —
 * along with the details this means. A detail key is the two-segment one.
 */
function eachChecklist(
	client: QueryClient,
	patch: (detail: ChecklistDetail) => ChecklistDetail,
): void {
	for (const [key] of client.getQueriesData({
		queryKey: queryKeys.checklists,
	})) {
		if (key.length !== 2) continue;

		client.setQueryData<ChecklistDetail>(key, (detail) =>
			detail ? recount(patch(detail)) : detail,
		);
	}
}

/**
 * Apply `patch` to the tasks on every tag page currently in the cache.
 *
 * The same walk as `eachChecklist`, for the same reason: `["tags"]` is the tag
 * list's own key as well as the first segment of every tag page's.
 */
function eachTag(
	client: QueryClient,
	patch: (entries: Array<TagTaskEntry>) => Array<TagTaskEntry>,
): void {
	for (const [key] of client.getQueriesData({ queryKey: queryKeys.tags })) {
		if (key.length !== 2) continue;

		client.setQueryData<TagDetail>(key, (detail) => {
			if (!detail) return detail;

			const tasks = patch(detail.tasks);
			return {
				...detail,
				tasks,
				progress: calculateChecklistProgress(tasks.map((entry) => entry.task)),
			};
		});
	}
}

function eachTaskList(
	client: QueryClient,
	patch: (lists: TaskLists) => TaskLists,
): void {
	client.setQueryData<TaskLists>(queryKeys.taskLists, (lists) =>
		lists ? patch(lists) : lists,
	);
}

/** Change one task wherever it is shown. */
function patchTask(
	client: QueryClient,
	taskId: string,
	change: (task: Task) => Task,
): void {
	eachChecklist(client, (detail) => ({
		...detail,
		tasks: detail.tasks.map((task) =>
			task.taskId === taskId ? change(task) : task,
		),
	}));

	eachTag(client, (entries) =>
		entries.map((entry) =>
			entry.task.taskId === taskId
				? { ...entry, task: change(entry.task) }
				: entry,
		),
	);

	eachTaskList(client, (lists) => ({
		today: lists.today.map((entry) =>
			entry.item.taskId === taskId && entry.task
				? { ...entry, task: change(entry.task) }
				: entry,
		),
		backlog: lists.backlog.map((entry) =>
			entry.item.taskId === taskId && entry.task
				? { ...entry, task: change(entry.task) }
				: entry,
		),
	}));
}

function dropTask(client: QueryClient, taskId: string): void {
	eachChecklist(client, (detail) => ({
		...detail,
		tasks: detail.tasks.filter((task) => task.taskId !== taskId),
	}));

	eachTag(client, (entries) =>
		entries.filter((entry) => entry.task.taskId !== taskId),
	);

	eachTaskList(client, (lists) => ({
		today: lists.today.filter((entry) => entry.item.taskId !== taskId),
		backlog: lists.backlog.filter((entry) => entry.item.taskId !== taskId),
	}));
}

function dropRef(client: QueryClient, itemId: string): void {
	eachTaskList(client, (lists) => ({
		today: lists.today.filter((entry) => entry.item.itemId !== itemId),
		backlog: lists.backlog.filter((entry) => entry.item.itemId !== itemId),
	}));
}

/**
 * Draw a change now.
 *
 * Returns nothing: the caller has already snapshotted the caches and rolls them
 * back wholesale if the request fails, which is simpler and safer than each
 * patch knowing how to undo itself.
 */
export function applyOptimistically(client: QueryClient, change: Change): void {
	switch (change.kind) {
		case "task.update":
			patchTask(client, change.taskId, (task) => ({
				...task,
				...change.patch,
				// The server stamps this one; guessing it here keeps the completed
				// section and the chart from re-sorting when the answer lands.
				completedAt:
					change.patch.completed === undefined
						? task.completedAt
						: change.patch.completed
							? new Date().toISOString()
							: null,
			}));
			return;

		case "task.delete":
			dropTask(client, change.taskId);
			return;

		case "task.create": {
			const task: Task = {
				taskId: change.taskId,
				title: change.title,
				completed: false,
				completedAt: null,
				trackerId: change.trackerId,
				addedAt: change.addedAt,
				tagIds: change.tagIds,
				urgent: change.urgent,
				important: change.important,
			};

			if (change.checklistId !== null) {
				const key = queryKeys.checklist(change.checklistId);
				client.setQueryData<ChecklistDetail>(key, (detail) =>
					detail
						? recount({ ...detail, tasks: [...detail.tasks, task] })
						: detail,
				);
			}

			// A task typed straight into a list names that list here, so the row is
			// drawn where it was typed instead of waiting for a refetch to reveal
			// it. Newest first, which is how the lists read.
			if (change.place !== null) {
				const place = change.place;
				const entry: TaskRefEntry = {
					item: {
						itemId: place.itemId,
						taskId: task.taskId,
						sortOrder: place.sortOrder,
						addedAt: task.addedAt,
					},
					list: place.list,
					checklistId: change.checklistId,
					// Left to the refetch: a title for a checklist this browser may
					// not have loaded is not something to guess at.
					checklistTitle: null,
					task,
				};

				eachTaskList(client, (lists) => ({
					...lists,
					[place.list]: [entry, ...lists[place.list]],
				}));
			}

			return;
		}

		case "checklist.create": {
			/*
			 * The app goes straight into a checklist the moment it is made, and
			 * that screen asks the server for it — often before the server has
			 * written it, which answered "That checklist no longer exists." for
			 * one that was only just beginning to. Drawn here first, the screen
			 * finds it in the cache instead, and the refetch after the write swaps
			 * in the server's copy.
			 */
			const createdAt = new Date().toISOString();
			const summary: ChecklistSummary = {
				checklistId: change.checklistId,
				title: change.title,
				description: change.description,
				startDate: change.startDate,
				deadline: change.deadline,
				createdAt,
				updatedAt: createdAt,
				progress: { total: 0, completed: 0, percent: 0 },
				// No tasks, so no pace: the same answer the server gives.
				status: null,
			};

			client.setQueryData<ChecklistDetail>(
				queryKeys.checklist(change.checklistId),
				{ ...summary, tasks: [] },
			);
			client.setQueryData<Array<ChecklistSummary>>(
				queryKeys.checklists,
				(list) => (list ? [...list, summary] : list),
			);
			return;
		}

		case "ref.remove":
			dropRef(client, change.itemId);
			return;

		case "ref.move":
			// Positions are swapped server-side from values this does not hold; the
			// refetch settles it, and the row is already where the eye expects.
			return;

		default:
			// Everything else happens behind a dialog, where the refetch is the
			// fastest honest answer.
			return;
	}
}

/** The caches a change can touch, snapshotted so a failure can be undone. */
export function snapshot(client: QueryClient) {
	return client.getQueriesData({ queryKey: [] });
}

export function restore(
	client: QueryClient,
	entries: ReturnType<typeof snapshot>,
): void {
	for (const [key, data] of entries) client.setQueryData(key, data);
}
