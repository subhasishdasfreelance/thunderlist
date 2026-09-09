/**
 * The Today and Backlog lists. Server only.
 *
 * Both store *references* to canonical tasks - never copies of them. Neither
 * has a completion field of its own: checking something off Today writes to the
 * task itself, so completion has exactly one home.
 *
 * The two lists are one collection told apart by `list`, because they are one
 * thing: a task belongs to at most one of them. Parking a task takes it off
 * Today, and pulling it back onto Today takes it out of the Backlog.
 */

import { collections, DOMAIN_FIELDS } from "#/lib/mongo/client.server";
import {
	SORT_ORDER_STEP,
	type TaskListName,
	type TaskRef,
	type TaskRefEntry,
} from "#/schemas/task-list";
import { readTasksByChecklist } from "./checklist.server";

/** A reference document holds the list it is on; a `TaskRef` does not. */
const REF_FIELDS = { _id: 0, list: 0 } as const;

/** Both lists, keyed by name. */
export type TaskLists = Record<TaskListName, Array<TaskRefEntry>>;

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Resolve every reference in both lists against its canonical task.
 *
 * Today and Backlog are read together because they draw on the same
 * checklists: resolving them in one pass means one task read rather than two,
 * and the checklist screen needs both to know which badge to show.
 *
 * References whose task or checklist has gone come back with `task: null`
 * rather than being dropped, so the user can see and clear them.
 */
export async function getTaskLists(): Promise<TaskLists> {
	const current = await collections();

	// Newest first: a reference is appended with a higher position than the last,
	// so reading in descending order puts what was just added at the top while
	// leaving the hand-made order underneath it intact.
	const items = await current.taskRefs
		.find(
			{},
			{ sort: { sortOrder: -1, itemId: -1 }, projection: DOMAIN_FIELDS },
		)
		.toArray();

	if (items.length === 0) return { today: [], backlog: [] };

	const checklistIds = [...new Set(items.map((item) => item.checklistId))];

	const [checklists, tasksByChecklist] = await Promise.all([
		current.checklists
			.find(
				{ checklistId: { $in: checklistIds } },
				{ projection: { _id: 0, checklistId: 1, title: 1 } },
			)
			.toArray(),
		readTasksByChecklist(checklistIds),
	]);

	const titles = new Map(
		checklists.map((checklist) => [checklist.checklistId, checklist.title]),
	);

	const resolve = (list: TaskListName): Array<TaskRefEntry> =>
		items
			.filter((item) => item.list === list)
			.map(({ list: _list, ...item }) => ({
				item,
				list,
				checklistTitle: titles.get(item.checklistId) ?? null,
				task:
					tasksByChecklist
						.get(item.checklistId)
						?.find((candidate) => candidate.taskId === item.taskId) ?? null,
			}));

	return { today: resolve("today"), backlog: resolve("backlog") };
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

export async function addTaskRef(input: {
	list: TaskListName;
	itemId: string;
	checklistId: string;
	taskId: string;
	sortOrder: number;
}): Promise<TaskRef> {
	const current = await collections();

	// Adding the same task twice is a no-op rather than an error.
	const existing = await current.taskRefs.findOne(
		{
			list: input.list,
			checklistId: input.checklistId,
			taskId: input.taskId,
		},
		{ projection: REF_FIELDS },
	);
	if (existing) return existing;

	// A task is planned or parked, never both.
	await current.taskRefs.deleteMany({
		list: input.list === "today" ? "backlog" : "today",
		checklistId: input.checklistId,
		taskId: input.taskId,
	});

	const last = await current.taskRefs.findOne(
		{ list: input.list },
		{ sort: { sortOrder: -1 }, projection: { _id: 0, sortOrder: 1 } },
	);

	const item: TaskRef = {
		itemId: input.itemId,
		checklistId: input.checklistId,
		taskId: input.taskId,
		sortOrder:
			input.sortOrder > 0
				? input.sortOrder
				: (last?.sortOrder ?? 0) + SORT_ORDER_STEP,
		addedAt: new Date().toISOString(),
	};

	await current.taskRefs.insertOne({ ...item, list: input.list });

	return item;
}

export async function removeTaskRef(
	list: TaskListName,
	itemId: string,
): Promise<void> {
	const current = await collections();

	// Already gone is the outcome this asked for, not a failure.
	await current.taskRefs.deleteOne({ itemId, list });
}

/**
 * Swap a reference with the one above or below it.
 *
 * Positions are swapped rather than renumbered, so a move is two writes however
 * long the list is. The list is read in the order it is drawn, newest first, so
 * "up" is up the screen. Equal positions - possible when two references were
 * added in the same moment - are nudged apart so the swap still lands.
 */
export async function moveTaskRef(
	list: TaskListName,
	itemId: string,
	direction: "up" | "down",
): Promise<void> {
	const current = await collections();

	// Same order the list is drawn in, so "up" means up the screen.
	const ordered = await current.taskRefs
		.find(
			{ list },
			{ sort: { sortOrder: -1, itemId: -1 }, projection: DOMAIN_FIELDS },
		)
		.toArray();

	const index = ordered.findIndex((item) => item.itemId === itemId);
	// The item was removed since the move was queued; there is nothing to move.
	if (index === -1) return;

	const neighbour = ordered[direction === "up" ? index - 1 : index + 1];
	// Already at the end of the list: nothing to do, and no write.
	if (!neighbour) return;

	const item = ordered[index];
	const nextOrder =
		item.sortOrder === neighbour.sortOrder
			? neighbour.sortOrder + (direction === "up" ? 1 : -1)
			: neighbour.sortOrder;

	await current.taskRefs.bulkWrite([
		{
			updateOne: {
				filter: { itemId: item.itemId },
				update: { $set: { sortOrder: nextOrder } },
			},
		},
		{
			updateOne: {
				filter: { itemId: neighbour.itemId },
				update: { $set: { sortOrder: item.sortOrder } },
			},
		},
	]);
}

/**
 * Drop references to tasks that no longer exist, from both lists.
 *
 * Called after a checklist or task is deleted. Passing no `taskIds` clears
 * every reference to the checklist.
 *
 * What is removed here is a pointer, never content: the task itself is untouched.
 */
export async function removeTaskRefsFor(
	checklistId: string,
	taskIds?: ReadonlyArray<string>,
): Promise<number> {
	const current = await collections();

	const result = await current.taskRefs.deleteMany({
		checklistId,
		...(taskIds === undefined ? {} : { taskId: { $in: [...taskIds] } }),
	});

	return result.deletedCount;
}
