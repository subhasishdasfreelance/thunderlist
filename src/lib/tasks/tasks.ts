/**
 * Task ordering and progress.
 *
 * Tasks are a flat list ordered by when they were added, so there is no
 * hierarchy to build and no position to keep in step with anything else. These
 * functions are pure and know nothing about the database.
 */

import type { ChecklistProgress } from "#/schemas/checklist";
import { PRIORITY_RANKS, priorityRank, type Task } from "#/schemas/task";

/**
 * Newest first, then by id.
 *
 * What you just added is what you are still thinking about, so it belongs at
 * the top rather than at the end of a list you have to scroll. Ties break on
 * `taskId`, which is time-sortable, so the order is total and stable.
 *
 * A task with no `addedAt` cannot be placed in time. Those sort last and,
 * because the comparison returns 0 between them and `sort` is stable, keep the
 * order they were read in.
 */
export function compareTasks(a: Task, b: Task): number {
	if (a.addedAt === "" || b.addedAt === "") {
		if (a.addedAt === b.addedAt) return 0;
		return a.addedAt === "" ? 1 : -1;
	}

	if (a.addedAt !== b.addedAt) return a.addedAt > b.addedAt ? -1 : 1;
	return a.taskId > b.taskId ? -1 : 1;
}

/** The order tasks are rendered in. Does not mutate its input. */
export function sortTasks(tasks: ReadonlyArray<Task>): Array<Task> {
	return [...tasks].sort(compareTasks);
}

/** How a list is ordered. More will follow; these are the two that exist. */
const SORT_ORDERS = ["newest", "priority"] as const;

export type SortOrder = (typeof SORT_ORDERS)[number];

export const SORT_ORDER_LABELS: Record<SortOrder, string> = {
	newest: "Newest first",
	priority: "Priority first",
};

/**
 * Urgent and important first, then urgent, then important, then the rest.
 *
 * Within a band the newest is still first, so sorting by priority reorders the
 * list rather than replacing one arbitrary order with another.
 */
export function sortTasksBy<T extends Pick<Task, "urgent" | "important">>(
	tasks: ReadonlyArray<T>,
	order: SortOrder,
	compare: (a: T, b: T) => number,
): Array<T> {
	if (order === "newest") return [...tasks].sort(compare);

	return [...tasks].sort((a, b) => {
		const byRank =
			PRIORITY_RANKS.indexOf(priorityRank(a)) -
			PRIORITY_RANKS.indexOf(priorityRank(b));
		return byRank === 0 ? compare(a, b) : byRank;
	});
}

/** The same, for the plain task lists that order by `compareTasks`. */
export function orderTasks(
	tasks: ReadonlyArray<Task>,
	order: SortOrder,
): Array<Task> {
	return sortTasksBy(tasks, order, compareTasks);
}

/**
 * A list's open tasks and its finished ones, read separately, as one list.
 *
 * For a moment a task can be in both — ticked on screen before either read has
 * caught up with it — and it is kept once, as `open` has it.
 */
export function mergeReads<T>(
	open: ReadonlyArray<T>,
	finished: ReadonlyArray<T>,
	idOf: (item: T) => string,
): Array<T> {
	const seen = new Set(open.map(idOf));
	return [...open, ...finished.filter((item) => !seen.has(idOf(item)))];
}

/**
 * Completion across the checklist. Counting every task equally keeps the number
 * the user sees the same as the number of checkboxes on screen.
 */
export function calculateChecklistProgress(
	tasks: ReadonlyArray<Pick<Task, "completed">>,
): ChecklistProgress {
	const total = tasks.length;
	const completed = tasks.reduce(
		(count, task) => (task.completed ? count + 1 : count),
		0,
	);

	return {
		total,
		completed,
		percent: total === 0 ? 0 : Math.round((completed / total) * 100),
	};
}
