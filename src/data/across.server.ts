/**
 * The Across lists and Priority screens' tasks. Server only.
 *
 * Every other list in the app is read a page at a time — one stage of one
 * checklist, one page of one tag — and this is the same thing for the cut that
 * spans every checklist: one group, one page of it, and the counts for the tabs
 * over it. The screen used to read every task in the space at once and do the
 * grouping, the ordering and the paging itself, which meant the whole space
 * crossed the wire to draw twenty rows.
 *
 * The grouping is the one the screen already showed: by the name of the stage
 * each task is at (`stagesByName`), or by the kind of work it is
 * (`tasksByType`) — or, for the Priority screen, by how urgent and important
 * it is (`byPriority`).
 */

import { collections, DOMAIN_FIELDS } from "#/lib/mongo/client.server";
import {
	matchesFilter,
	orderByTask,
	type Page,
	pageOf,
} from "#/lib/tasks/tasks";
import {
	checklistStages,
	type Stage,
	stageOf,
	stageProgress,
	stagesByName,
} from "#/schemas/checklist";
import {
	type AcrossPageView,
	PRIORITY_LABELS,
	PRIORITY_RANKS,
	priorityRank,
	type Task,
} from "#/schemas/task";
import { tasksByType } from "#/schemas/task-type";
import { ensureInbox, withTrackedCompletion } from "./checklist.server";
import { listTaskTypes } from "./settings.server";
import { type Hidden, isTaskVisible } from "./visibility.server";

/** One task with the checklist it lives in, which every row names. */
export type AcrossTask = Task & {
	/** `null` only for a task written before every task had a checklist. */
	checklistId: string | null;
	checklistTitle: string | null;
	/** Drawn under the title, as on the Tags and Priority screens. */
	caption: string;
};

/** One tab: a stage name, or a kind of work, and how many tasks are in it. */
export type AcrossGroup = { key: string; name: string; count: number };

/**
 * A page of one group, with every group's name and count for the tabs.
 *
 * `key` is the group actually shown — the one asked for, or the first, since a
 * cut that has just been switched has no group picked in it yet.
 */
export type AcrossPage = Page<AcrossTask> & {
	key: string;
	groups: Array<AcrossGroup>;
};

/** Every task this person can see, with where it lives and the stage it is at. */
async function readAcrossTasks(
	userId: string,
	hidden: Hidden,
): Promise<{
	checklists: Array<{ checklistId: string; stages?: Array<Stage> }>;
	tasks: Array<AcrossTask>;
}> {
	// Anything still in no checklist moves into the Inbox before it is listed.
	await ensureInbox(userId);
	const current = await collections();

	const [checklists, stored] = await Promise.all([
		current.checklists
			.find(
				{ userId },
				{ projection: { _id: 0, checklistId: 1, title: 1, stages: 1 } },
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

	// Finished by its tracker counts as finished; see `withTrackedCompletion`.
	const tasks = await withTrackedCompletion(
		current,
		userId,
		stored.filter((task) => isTaskVisible(task, hidden)),
	);

	return {
		checklists: visible,
		tasks: tasks.map((task) => {
			const checklist =
				task.checklistId === null ? undefined : byId.get(task.checklistId);

			return {
				...task,
				checklistTitle: checklist?.title ?? null,
				// The stage it is at, as its checklist's own page has it.
				stageId: stageOf(task, checklistStages(checklist ?? {})),
				caption: task.caption ?? "",
			};
		}),
	};
}

/**
 * The four corners of urgent and important, each with its open tasks, in
 * order: the corner to do first, first. Finished work is in none of them —
 * the question is what to do next.
 */
function byPriority(
	tasks: ReadonlyArray<AcrossTask>,
): Array<{ key: string; name: string; tasks: Array<AcrossTask> }> {
	const open = tasks.filter((task) => !task.completed);
	return PRIORITY_RANKS.map((rank) => ({
		key: rank,
		name: PRIORITY_LABELS[rank],
		tasks: open.filter((task) => priorityRank(task) === rank),
	}));
}

export async function getAcrossTasks(
	userId: string,
	view: AcrossPageView,
	hidden: Hidden,
): Promise<AcrossPage> {
	const { checklists, tasks } = await readAcrossTasks(userId, hidden);
	const narrowed = tasks.filter((task) => matchesFilter(task, view));

	// Cut by type, the tabs are the kinds of work, so the list is needed either
	// way — to name them, or to order by them.
	const types =
		view.groupBy === "type" || view.sort === "type"
			? await listTaskTypes(userId)
			: [];

	const groups =
		view.groupBy === "stage"
			? stagesByName(checklists, narrowed)
			: view.groupBy === "type"
				? tasksByType(types, narrowed)
				: byPriority(narrowed);

	const group = groups.find((each) => each.key === view.group) ?? groups[0];
	const stagesOf = (checklistId: string | null) =>
		checklistStages(
			checklists.find((each) => each.checklistId === checklistId) ?? {},
		);

	return {
		...pageOf(
			orderByTask(
				group?.tasks ?? [],
				view.sort,
				(task) => task,
				// Only meaningful cut by type, where one group holds tasks at every
				// stage of every list; see `stageProgress`.
				(task) => stageProgress(task, stagesOf(task.checklistId)),
				view.sort === "type" ? types : undefined,
			),
			view,
			(task) => task.taskId,
		),
		key: group?.key ?? "",
		groups: groups.map((each) => ({
			key: each.key,
			name: each.name,
			count: each.tasks.length,
		})),
	};
}
