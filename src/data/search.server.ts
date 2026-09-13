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
import { checklistStages, stageOf } from "#/schemas/checklist";
import type { Task } from "#/schemas/task";
import type { TrackerType } from "#/schemas/tracker";
import { ensureInbox } from "./checklist.server";
import { type Hidden, isTaskVisible } from "./visibility.server";

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
	/**
	 * Every task, whole, with the checklist it lives in: the Priority screen
	 * draws each with the row a checklist uses, and edits it with the same
	 * dialog, notes and all.
	 */
	tasks: Array<
		Task & {
			/** `null` only for a task written before every task had a checklist. */
			checklistId: string | null;
			checklistTitle: string | null;
			/** Drawn under the title on the Tags and Priority screens. */
			caption: string;
		}
	>;
};

export async function getSearchIndex(
	userId: string,
	hidden: Hidden,
): Promise<SearchIndex> {
	// Anything still in no checklist moves into the Inbox before it is listed.
	await ensureInbox(userId);
	const current = await collections();

	const [checklists, trackers, tasks] = await Promise.all([
		current.checklists
			.find(
				{ userId },
				{
					projection: {
						_id: 0,
						checklistId: 1,
						title: 1,
						description: 1,
						stages: 1,
					},
				},
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

	// Anything kept from this person in their team is left out, as everywhere.
	const visible = checklists.filter(
		(checklist) => !hidden.checklistIds.has(checklist.checklistId),
	);
	const byId = new Map(
		visible.map((checklist) => [checklist.checklistId, checklist]),
	);

	return {
		checklists: visible.map(({ checklistId, title, description }) => ({
			checklistId,
			title,
			description,
		})),
		trackers: trackers.filter(
			(tracker) => !hidden.trackerIds.has(tracker.trackerId),
		),
		tasks: tasks
			.filter((task) => isTaskVisible(task, hidden))
			.map((task) => {
				const checklist =
					task.checklistId === null ? undefined : byId.get(task.checklistId);

				return {
					...task,
					checklistTitle: checklist?.title ?? null,
					// The stage it is at, as its checklist's own page has it.
					stageId: stageOf(task, checklistStages(checklist ?? {})),
					urgent: task.urgent ?? false,
					important: task.important ?? false,
					caption: task.caption ?? "",
				};
			}),
	};
}
