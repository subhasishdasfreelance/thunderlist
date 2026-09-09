/**
 * The Today and Backlog lists. Server only.
 *
 * Both store *references* to canonical tasks - never copies of them. Neither
 * has a completion field of its own: checking something off Today writes to the
 * task itself, so completion has exactly one home.
 *
 * A reference names a task and nothing else. That is what lets a task written
 * straight onto Today belong to no checklist at all: there is nothing else for
 * the reference to point at, and so nothing to invent to hold it.
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
import { readTasksByIds } from "./checklist.server";

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
 * Today and Backlog are read together because they draw on the same tasks:
 * resolving them in one pass means one task read rather than two, and the
 * checklist screen needs both to know which badge to show.
 *
 * References whose task has gone come back with `task: null` rather than being
 * dropped, so the user can see and clear them. A `checklistTitle` of `null` is
 * an ordinary task that belongs to no checklist, not a fault.
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

	const tasks = await readTasksByIds([
		...new Set(items.map((item) => item.taskId)),
	]);

	const checklistIds = [
		...new Set(
			[...tasks.values()].flatMap((found) =>
				found.checklistId === null ? [] : [found.checklistId],
			),
		),
	];

	const checklists = await current.checklists
		.find(
			{ checklistId: { $in: checklistIds } },
			{ projection: { _id: 0, checklistId: 1, title: 1 } },
		)
		.toArray();

	const titles = new Map(
		checklists.map((checklist) => [checklist.checklistId, checklist.title]),
	);

	const resolve = (list: TaskListName): Array<TaskRefEntry> =>
		items
			.filter((item) => item.list === list)
			.map(({ list: _list, ...item }) => {
				const found = tasks.get(item.taskId);
				const checklistId = found?.checklistId ?? null;

				return {
					item,
					list,
					checklistId,
					checklistTitle:
						checklistId === null ? null : (titles.get(checklistId) ?? null),
					task: found?.task ?? null,
				};
			});

	return { today: resolve("today"), backlog: resolve("backlog") };
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

export async function addTaskRef(input: {
	list: TaskListName;
	itemId: string;
	taskId: string;
	sortOrder: number;
}): Promise<TaskRef> {
	const current = await collections();

	// Adding the same task twice is a no-op rather than an error.
	const existing = await current.taskRefs.findOne(
		{ list: input.list, taskId: input.taskId },
		{ projection: REF_FIELDS },
	);
	if (existing) return existing;

	// A task is planned or parked, never both.
	await current.taskRefs.deleteMany({
		list: input.list === "today" ? "backlog" : "today",
		taskId: input.taskId,
	});

	const last = await current.taskRefs.findOne(
		{ list: input.list },
		{ sort: { sortOrder: -1 }, projection: { _id: 0, sortOrder: 1 } },
	);

	const item: TaskRef = {
		itemId: input.itemId,
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

	const ordered = await current.taskRefs
		.find(
			{ list },
			{ sort: { sortOrder: -1, itemId: -1 }, projection: DOMAIN_FIELDS },
		)
		.toArray();

	const index = ordered.findIndex((item) => item.itemId === itemId);
	// The item was removed since the move was asked for; there is nothing to move.
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
 * Drop every reference to the given tasks, from both lists.
 *
 * Called after a task, or a whole checklist of them, is deleted. What is
 * removed here is a pointer, never content: the task itself is untouched.
 */
export async function removeTaskRefsFor(
	taskIds: ReadonlyArray<string>,
): Promise<number> {
	if (taskIds.length === 0) return 0;

	const current = await collections();
	const result = await current.taskRefs.deleteMany({
		taskId: { $in: [...taskIds] },
	});

	return result.deletedCount;
}
