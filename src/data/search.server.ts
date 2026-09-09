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
		checklistId: string;
		checklistTitle: string;
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

	const [checklists, trackers, tasks] = await Promise.all([
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
	]);

	const titles = new Map(
		checklists.map((checklist) => [checklist.checklistId, checklist.title]),
	);

	return {
		checklists,
		trackers,
		// A task whose checklist has gone cannot be opened, so it is not offered.
		tasks: tasks.flatMap((task) => {
			const checklistTitle = titles.get(task.checklistId);
			if (checklistTitle === undefined) return [];

			return [
				{
					taskId: task.taskId,
					checklistId: task.checklistId,
					checklistTitle,
					title: task.title,
					completed: task.completed,
					tagIds: task.tagIds,
					urgent: task.urgent ?? false,
					important: task.important ?? false,
				},
			];
		}),
	};
}
