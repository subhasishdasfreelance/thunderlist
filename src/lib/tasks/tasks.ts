/**
 * Task ordering and progress.
 *
 * Tasks are a flat list ordered by when they were added, so there is no
 * hierarchy to build and no position to keep in step with anything else. These
 * functions are pure and know nothing about the database.
 */

import { formatDeadline } from "#/lib/format-date";
import type { Checklist, ChecklistProgress } from "#/schemas/checklist";
import {
	NO_TYPE,
	PRIORITY_RANKS,
	priorityRank,
	type SORT_ORDERS,
	type Task,
	type TaskFilter,
} from "#/schemas/task";

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

/**
 * Whether something is assigned to one person in a team — or, with nobody
 * picked, whether it is anything at all, which it always is.
 */
export function isAssignedTo(
	item: { assignees?: ReadonlyArray<string> },
	email: string | undefined,
): boolean {
	return email === undefined || (item.assignees ?? []).includes(email);
}

/** Whether a task is one a screen's filter lets through; see `TaskFilter`. */
export function matchesFilter(
	task: {
		assignees?: ReadonlyArray<string>;
		tagIds: ReadonlyArray<string>;
		typeId?: string | null;
		trackerId?: string | null;
	},
	filter: TaskFilter,
): boolean {
	return (
		isAssignedTo(task, filter.assignee) &&
		(filter.tag === undefined || task.tagIds.includes(filter.tag)) &&
		(filter.type === undefined || (task.typeId ?? NO_TYPE) === filter.type) &&
		(filter.tracker === undefined || task.trackerId === filter.tracker)
	);
}

/** The order tasks are rendered in. Does not mutate its input. */
export function sortTasks(tasks: ReadonlyArray<Task>): Array<Task> {
	return [...tasks].sort(compareTasks);
}

/**
 * A task's notes after it moves, with a line added at the end when it is
 * parked in the Backlog ("Added from Design system") or taken out of it
 * ("Moved from backlog"), led by when — "Tue, Sep 29, 2026, 3:45 pm — Moved from
 * backlog". `null` for any other move, which leaves them alone.
 *
 * Parked tasks from every list sit together, and without the note the one
 * thing you need to put a task back — where it came from — is the one thing
 * the move throws away. The caption is the user's and is not touched.
 */
export function notesAfterMove(
	notes: string | undefined,
	/** The checklist it leaves, or `null` when it is in none. */
	from: Pick<Checklist, "title" | "special"> | null,
	to: Pick<Checklist, "special">,
	/** When, on the mover's clock; a move sent without one says only where. */
	at?: { date: string; time: string },
): string | null {
	const what =
		from?.special === "backlog"
			? "Moved from backlog"
			: to.special === "backlog" && from !== null
				? `Added from ${from.title}`
				: null;
	if (what === null) return null;

	const line =
		at === undefined ? what : `${formatDeadline(at.date, at.time)} — ${what}`;

	/*
	 * On the next line, with no blank one between. Notes are Markdown, where a
	 * bare newline runs the two lines together, so it is a line break: two
	 * spaces, then the newline.
	 */
	const before = (notes ?? "").trim();
	return before === "" ? line : `${before}  \n${line}`;
}

/**
 * The tags every one of these tasks carries.
 *
 * What a tag picker ticks when it is open over several tasks: a tag only one
 * of them has is not a tag "they" have, and ticking it would say it was.
 */
export function sharedTagIds(
	tasks: ReadonlyArray<Pick<Task, "tagIds">> | null,
): Array<string> {
	if (tasks === null || tasks.length === 0) return [];

	return tasks[0].tagIds.filter((tagId) =>
		tasks.every((task) => task.tagIds.includes(tagId)),
	);
}

/** The people every one of these tasks is assigned to; see `assignAlike`. */
export function sharedAssignees(
	tasks: ReadonlyArray<Pick<Task, "assignees">> | null,
): Array<string> {
	if (tasks === null || tasks.length === 0) return [];

	return (tasks[0].assignees ?? []).filter((email) =>
		tasks.every((task) => (task.assignees ?? []).includes(email)),
	);
}

/**
 * A task's title cut short, for a confirmation that names it: enough to know
 * it by, never the whole of a long one.
 */
export function shortTitle(title: string, max = 48): string {
	const trimmed = title.trim();
	return trimmed.length <= max
		? trimmed
		: `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/** How a list is ordered. */
export type SortOrder = (typeof SORT_ORDERS)[number];

export const SORT_ORDER_LABELS: Record<SortOrder, string> = {
	newest: "Newest first",
	priority: "Priority first",
	deadline: "Deadline first",
	stage: "Earliest stage first",
	type: "By type",
	name: "A to Z",
};

/**
 * Alphabetical, the way a person reads a list: case and accents aside, and
 * "Day 2" before "Day 10".
 */
export function compareNames(a: string, b: string): number {
	return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

/**
 * The earlier day first, and no deadline after any. Days are `YYYY-MM-DD`, so
 * they compare as text.
 */
function compareDeadlines(
	a: string | null | undefined,
	b: string | null | undefined,
): number {
	if (!a || !b) return a ? -1 : b ? 1 : 0;
	return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Urgent and important first, then urgent, then important, then the rest — or,
 * by stage, the tasks still at their first stage first and the done last, the
 * stages between in order of how far along they are; see `stageProgress`; or
 * by type, in the order the space keeps its types in, the untyped last; or by
 * deadline, the soonest due first and the tasks with none after every one
 * that has one; or by name, A to Z.
 *
 * Within a band the newest is still first, so sorting reorders the list rather
 * than replacing one arbitrary order with another.
 */
function sortTasksBy<
	T extends Pick<Task, "urgent" | "important" | "deadline" | "title">,
>(
	tasks: ReadonlyArray<T>,
	order: SortOrder,
	compare: (a: T, b: T) => number,
	/** How far along each is, 0-1. Without it, by stage is newest first. */
	stageProgressOf?: (task: T) => number,
	/** Where each one's type sits in the list. Without it, by type is newest first. */
	typeRankOf?: (task: T) => number,
): Array<T> {
	if (order === "deadline") {
		return [...tasks].sort(
			(a, b) => compareDeadlines(a.deadline, b.deadline) || compare(a, b),
		);
	}
	if (order === "name") {
		return [...tasks].sort(
			(a, b) => compareNames(a.title, b.title) || compare(a, b),
		);
	}

	const rank =
		order === "priority"
			? (task: T) => PRIORITY_RANKS.indexOf(priorityRank(task))
			: order === "stage"
				? stageProgressOf
				: order === "type"
					? typeRankOf
					: undefined;
	if (rank === undefined) return [...tasks].sort(compare);

	return [...tasks].sort((a, b) => rank(a) - rank(b) || compare(a, b));
}

/**
 * Where a task's type sits in the space's list, for ordering by it: the list's
 * own order, since that is the order whoever wrote it chose, and the tasks
 * with no type after every one that has one.
 */
function typeRanker(
	types: ReadonlyArray<{ typeId: string }>,
): (task: { typeId?: string | null }) => number {
	const ranks = new Map(types.map((type, index) => [type.typeId, index]));
	return (task) => ranks.get(task.typeId ?? "") ?? types.length;
}

/** The same, for the plain task lists that order by `compareTasks`. */
export function orderTasks(
	tasks: ReadonlyArray<Task>,
	order: SortOrder,
	/** The space's types, in their order, for `type`; see `typeRanker`. */
	types?: ReadonlyArray<{ typeId: string }>,
): Array<Task> {
	return sortTasksBy(
		tasks,
		order,
		compareTasks,
		undefined,
		types === undefined ? undefined : typeRanker(types),
	);
}

/** The same, for rows that carry a task rather than being one: a tag's. */
export function orderByTask<T>(
	items: ReadonlyArray<T>,
	order: SortOrder,
	taskOf: (item: T) => Task,
	stepsLeftOf?: (item: T) => number,
	/** The space's types, in their order, for `type`; see `typeRanker`. */
	types?: ReadonlyArray<{ typeId: string }>,
): Array<T> {
	const rankType = types === undefined ? undefined : typeRanker(types);

	return sortTasksBy(
		items.map((item) => ({
			item,
			urgent: taskOf(item).urgent,
			important: taskOf(item).important,
			deadline: taskOf(item).deadline,
			title: taskOf(item).title,
		})),
		order,
		(a, b) => compareTasks(taskOf(a.item), taskOf(b.item)),
		stepsLeftOf === undefined ? undefined : (row) => stepsLeftOf(row.item),
		rankType === undefined ? undefined : (row) => rankType(taskOf(row.item)),
	).map((row) => row.item);
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
 * One page of a list read from the server: its rows, how many there are in
 * all, and which page this is — numbered from 1.
 */
export type Page<T> = { items: Array<T>; total: number; page: number };

/**
 * A page of one stage of a checklist, with how many tasks are at each stage —
 * the same filter applied to all of them — for the switch between stages.
 */
export type StagePage = Page<Task> & {
	stageId: string;
	counts: Record<string, number>;
};

/**
 * The page of an ordered list a screen asked for, `limit` rows long.
 *
 * With no page named it is the one holding the row to reveal, or the first. A
 * page past the end — the list got shorter under it — is the last one there
 * is, so a screen never lands on an empty page of a list that is not empty.
 */
export function pageOf<T>(
	ordered: ReadonlyArray<T>,
	view: { limit: number; page?: number; reveal?: string },
	idOf: (item: T) => string,
): Page<T> {
	const pageCount = Math.max(1, Math.ceil(ordered.length / view.limit));
	const revealAt =
		view.reveal === undefined
			? -1
			: ordered.findIndex((item) => idOf(item) === view.reveal);
	const wanted =
		view.page ?? (revealAt === -1 ? 1 : Math.floor(revealAt / view.limit) + 1);
	const page = Math.min(Math.max(wanted, 1), pageCount);

	return {
		items: ordered.slice((page - 1) * view.limit, page * view.limit),
		total: ordered.length,
		page,
	};
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
