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
		/** `null` for a task that belongs to no checklist. */
		checklistId: string | null;
		checklistTitle: string | null;
		title: string;
		completed: boolean;
		/** Ids into the tags collection; the Tags screen groups on these. */
		tagIds: Array<string>;
		/** The Priority screen groups on these; see `priorityRank`. */
		urgent: boolean;
		important: boolean;
		/** Drawn under the title on the Tags and Priority screens. */
		caption: string;
	}>;
};

export async function getSearchIndex(userId: string): Promise<SearchIndex> {
	const current = await collections();

	const [checklists, trackers, tasks] = await Promise.all([
		current.checklists
			.find(
				{ userId },
				{ projection: { _id: 0, checklistId: 1, title: 1, description: 1 } },
			)
			.toArray(),
		current.trackers
			.find(
				{ userId },
				{ projection: { _id: 0, trackerId: 1, title: 1, type: 1, author: 1 } },
			)
			.toArray(),
		current.tasks.find({ userId }, { projection: DOMAIN_FIELDS }).toArray(),
	]);

	const titles = new Map(
		checklists.map((checklist) => [checklist.checklistId, checklist.title]),
	);

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
			title: task.title,
			completed: task.completed,
			tagIds: task.tagIds,
			urgent: task.urgent ?? false,
			important: task.important ?? false,
			caption: task.caption ?? "",
		})),
	};
}
