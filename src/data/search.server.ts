/**
 * The search index. Server only.
 *
 * Search is deliberately not a separate store: the index is assembled from the
 * same collections the rest of the app reads and filtered on the client.
 *
 * It doubles as the task source for the Tags screen, which needs exactly the
 * same thing - every task with its checklist and its tags - and so costs no
 * extra read.
 */

import { collections, DOMAIN_FIELDS } from "#/lib/mongo/client.server";
import type { TaskListName } from "#/schemas/task-list";
import type { TrackerType } from "#/schemas/tracker";

export type SearchIndex = {
	checklists: Array<{
		checklistId: string;
		title: string;
		description: string;
	}>;
	trackers: Array<{
		trackerId: string;
		title: string;
		type: TrackerType;
		author: string | null;
	}>;
	tasks: Array<{
		taskId: string;
		/** `null` for a task that belongs to no checklist. */
		checklistId: string | null;
		checklistTitle: string | null;
		/**
		 * Where to go to see a task that has no checklist: search has to send the
		 * reader somewhere, and a loose task exists only on one of the lists.
		 * `null` when the task has a checklist, which is the page for it.
		 */
		list: TaskListName | null;
		title: string;
		completed: boolean;
		/** Ids into the tags collection; the Tags screen groups on these. */
		tagIds: Array<string>;
		/** The Priority screen groups on these; see `priorityRank`. */
		urgent: boolean;
		important: boolean;
	}>;
};

export async function getSearchIndex(): Promise<SearchIndex> {
	const current = await collections();

	const [checklists, trackers, tasks, refs] = await Promise.all([
		current.checklists
			.find(
				{},
				{ projection: { _id: 0, checklistId: 1, title: 1, description: 1 } },
			)
			.toArray(),
		current.trackers
			.find(
				{},
				{ projection: { _id: 0, trackerId: 1, title: 1, type: 1, author: 1 } },
			)
			.toArray(),
		current.tasks.find({}, { projection: DOMAIN_FIELDS }).toArray(),
		// Only for the tasks with no checklist below, but reading the refs whole
		// is one query where a filtered one would need the task ids first.
		current.taskRefs
			.find({}, { projection: { _id: 0, taskId: 1, list: 1 } })
			.toArray(),
	]);

	const titles = new Map(
		checklists.map((checklist) => [checklist.checklistId, checklist.title]),
	);

	// A task can be on both lists; Today is the one worth being sent to.
	const lists = new Map<string, TaskListName>();
	for (const ref of refs) {
		if (ref.list === "today" || lists.get(ref.taskId) === undefined) {
			lists.set(ref.taskId, ref.list);
		}
	}

	return {
		checklists,
		trackers,
		tasks: tasks.map((task) => ({
			taskId: task.taskId,
			checklistId: task.checklistId,
			// A task in no checklist has no title to show, which is not a fault.
			checklistTitle:
				task.checklistId === null
					? null
					: (titles.get(task.checklistId) ?? null),
			list: task.checklistId === null ? (lists.get(task.taskId) ?? null) : null,
			title: task.title,
			completed: task.completed,
			tagIds: task.tagIds,
			urgent: task.urgent ?? false,
			important: task.important ?? false,
		})),
	};
}
