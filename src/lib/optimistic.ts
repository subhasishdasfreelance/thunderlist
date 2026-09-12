/**
 * Showing a change before the server has confirmed it.
 *
 * A tick, a flag, a task typed and entered — these are things the user has
 * already decided. Waiting a round trip to redraw them makes the app feel like
 * it is thinking about whether to agree, so the caches are patched immediately
 * and the request goes out behind it.
 *
 * Only the changes made *while reading a list* are patched here: ticking,
 * flagging, tagging, adding and removing. The rest — editing a checklist,
 * creating a tracker — happen in a dialog that closes anyway, where a moment's
 * wait costs nothing and a second copy of the write logic would. Creating a
 * checklist is the exception, because the app goes straight into the new one;
 * see below.
 *
 * Every patch is a guess. It is replaced by the server's answer on the next
 * refetch, and thrown away if the request fails, so a wrong guess is visible
 * for one round trip and never persists.
 */

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { unwrittenTags } from "#/lib/tags/inline-tags";
import type { Page } from "#/lib/tasks/tasks";
import { queryKeys } from "#/queries/keys";
import type { Change } from "#/schemas/change";
import type { ChecklistProgress, ChecklistSummary } from "#/schemas/checklist";
import type { Tag, TagDetail, TagTaskEntry } from "#/schemas/tag";
import type { Task } from "#/schemas/task";

/**
 * A list's counts, moved by one task arriving, leaving or being ticked.
 *
 * Moved rather than recounted: a page holds its open tasks and reads its
 * finished ones separately and later, so what it holds is not the whole list
 * to count. `null` is a task not there — before it arrived, after it left.
 */
function shift(
	progress: ChecklistProgress,
	before: Pick<Task, "completed"> | null,
	after: Pick<Task, "completed"> | null,
): ChecklistProgress {
	const total = Math.max(
		0,
		progress.total + (after ? 1 : 0) - (before ? 1 : 0),
	);
	const completed = Math.min(
		total,
		Math.max(
			0,
			progress.completed +
				(after?.completed ? 1 : 0) -
				(before?.completed ? 1 : 0),
		),
	);

	return {
		total,
		completed,
		percent: total === 0 ? 0 : Math.round((completed / total) * 100),
	};
}

/** `items` with the one matching swapped for `next`, or taken out for `null`. */
function swap<T>(
	items: ReadonlyArray<T>,
	matches: (item: T) => boolean,
	next: T | null,
): Array<T> {
	return items.flatMap((item) =>
		!matches(item) ? [item] : next === null ? [] : [next],
	);
}

/**
 * A page of a list with the one matching swapped for `next`, or taken out for
 * `null`. A row taken out comes off the count too, so "Show more" does not
 * promise one that is no longer there.
 */
function swapInPage<T>(
	page: Page<T>,
	matches: (item: T) => boolean,
	next: T | null,
): Page<T> {
	const items = swap(page.items, matches, next);
	return { items, total: page.total - (page.items.length - items.length) };
}

/**
 * A row arriving in a list: added to every page of it in the cache, and
 * counted. Where it sits is decided by the screen's order, not by its place in
 * the array.
 */
function addToPages<T>(client: QueryClient, list: QueryKey, item: T): void {
	for (const [key, page] of client.getQueriesData<Page<T>>({
		queryKey: list,
	})) {
		if (page) {
			client.setQueryData<Page<T>>(key, {
				items: [...page.items, item],
				total: page.total + 1,
			});
		}
	}
}

/**
 * Change one task on every checklist page in the cache.
 *
 * A page is three caches: the checklist, with the counts; its open tasks, read
 * a page at a time, one cache for each length and order read; and its finished
 * tasks, read on their own once asked for. The task is changed wherever it is
 * held and the counts move with it. A tick does not carry it across — the
 * screen sorts the reads together, and the next read puts it where it belongs.
 *
 * The keys are walked rather than matched as a prefix: `["checklists"]` is both
 * the summary list's own key and the first segment of every other checklist
 * key, so a prefix match hands back the summaries — an array, with no
 * `progress` on it — and every page of tasks along with the checklists this
 * means. A checklist's own key is the two-segment one.
 *
 * `next` returns `null` to take the task off the page.
 */
function patchChecklists(
	client: QueryClient,
	taskId: string,
	next: (task: Task) => Task | null,
): void {
	const matches = (task: Task) => task.taskId === taskId;

	for (const [key] of client.getQueriesData({
		queryKey: queryKeys.checklists,
	})) {
		if (key.length !== 2) continue;

		const checklistId = String(key[1]);
		const checklist = client.getQueryData<ChecklistSummary>(key);
		const pages = client.getQueriesData<Page<Task>>({
			queryKey: queryKeys.checklistOpen(checklistId),
		});
		const doneKey = queryKeys.checklistCompleted(checklistId);
		const done = client.getQueryData<Array<Task>>(doneKey);

		const before =
			pages.flatMap(([, page]) => page?.items ?? []).find(matches) ??
			done?.find(matches);
		if (!checklist || !before) continue;

		const after = next(before);
		client.setQueryData<ChecklistSummary>(key, {
			...checklist,
			progress: shift(checklist.progress, before, after),
		});
		for (const [pageKey, page] of pages) {
			if (page) client.setQueryData(pageKey, swapInPage(page, matches, after));
		}
		if (done) client.setQueryData(doneKey, swap(done, matches, after));
	}
}

/**
 * The same, for every tag page in the cache — walked by key for the same
 * reason, since `["tags"]` is the tag list's own key too. `next` is told which
 * tag the page is for.
 */
function patchTags(
	client: QueryClient,
	taskId: string,
	next: (task: Task, tagId: string) => Task | null,
): void {
	const matches = (entry: TagTaskEntry) => entry.task.taskId === taskId;

	for (const [key] of client.getQueriesData({ queryKey: queryKeys.tags })) {
		if (key.length !== 2) continue;

		// The page's address, which for Today is `today` rather than its id.
		const address = String(key[1]);
		const detail = client.getQueryData<TagDetail>(key);
		const pages = client.getQueriesData<Page<TagTaskEntry>>({
			queryKey: queryKeys.tagOpen(address),
		});
		const doneKey = queryKeys.tagCompleted(address);
		const done = client.getQueryData<Array<TagTaskEntry>>(doneKey);

		const before =
			pages.flatMap(([, page]) => page?.items ?? []).find(matches) ??
			done?.find(matches);
		if (!detail || !before) continue;

		const task = next(before.task, detail.tagId);
		const after = task === null ? null : { ...before, task };
		client.setQueryData<TagDetail>(key, {
			...detail,
			progress: shift(detail.progress, before.task, task),
		});
		for (const [pageKey, page] of pages) {
			if (page) client.setQueryData(pageKey, swapInPage(page, matches, after));
		}
		if (done) client.setQueryData(doneKey, swap(done, matches, after));
	}
}

/** Change one task wherever it is shown. */
function patchTask(
	client: QueryClient,
	taskId: string,
	change: (task: Task) => Task,
): void {
	patchChecklists(client, taskId, change);

	// A tag's page shows the tasks carrying it, so one that has just lost the
	// tag — taken off Today with the bolt — leaves the page now, not on the
	// refetch.
	patchTags(client, taskId, (task, tagId) => {
		const next = change(task);
		return next.tagIds.includes(tagId) ? next : null;
	});
}

function dropTask(client: QueryClient, taskId: string): void {
	patchChecklists(client, taskId, () => null);
	patchTags(client, taskId, () => null);
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
		case "task.update": {
			const tags = client.getQueryData<Array<Tag>>(queryKeys.tags) ?? [];

			patchTask(client, change.taskId, (task) => ({
				...task,
				...change.patch,
				// The server adds a task's checklist tags back to whatever an edit
				// sends. Keeping the ones its title never wrote does the same here,
				// so their chips do not blink off until the answer lands.
				tagIds:
					change.patch.tagIds === undefined
						? task.tagIds
						: [
								...new Set([
									...change.patch.tagIds,
									...unwrittenTags(task.title, task.tagIds, tags).map(
										(tag) => tag.tagId,
									),
								]),
							],
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
		}

		case "task.delete":
			dropTask(client, change.taskId);
			return;

		// Gone from the checklist it left at once. The one it joined shows it on
		// its next read, with the tags the server works out for it there.
		case "task.move":
			patchChecklists(client, change.taskId, () => null);
			return;

		case "task.create": {
			// A task added to a checklist carries its tags as well, just as the
			// server will store it; see `createTask`.
			const inherited =
				change.checklistId === null
					? []
					: (client.getQueryData<ChecklistSummary>(
							queryKeys.checklist(change.checklistId),
						)?.tagIds ?? []);

			const task: Task = {
				taskId: change.taskId,
				title: change.title,
				completed: false,
				completedAt: null,
				trackerId: change.trackerId,
				linkedChecklistId: change.linkedChecklistId,
				addedAt: change.addedAt,
				tagIds: [...new Set([...change.tagIds, ...inherited])],
				urgent: change.urgent,
				important: change.important,
			};

			if (change.checklistId !== null) {
				client.setQueryData<ChecklistSummary>(
					queryKeys.checklist(change.checklistId),
					(checklist) =>
						checklist
							? {
									...checklist,
									progress: shift(checklist.progress, null, task),
								}
							: checklist,
				);
				addToPages(client, queryKeys.checklistOpen(change.checklistId), task);
			}

			// A task typed on a tag's page is drawn there at once instead of
			// waiting for a refetch to reveal it.
			for (const [key] of client.getQueriesData({ queryKey: queryKeys.tags })) {
				if (key.length !== 2) continue;

				const detail = client.getQueryData<TagDetail>(key);
				if (!detail || !task.tagIds.includes(detail.tagId)) continue;

				client.setQueryData<TagDetail>(key, {
					...detail,
					progress: shift(detail.progress, null, task),
				});
				addToPages<TagTaskEntry>(client, queryKeys.tagOpen(String(key[1])), {
					task,
					checklistId: change.checklistId,
					// Left to the refetch: a title for a checklist this browser may
					// not have loaded is not something to guess.
					checklistTitle: null,
				});
			}

			return;
		}

		case "checklist.create": {
			/*
			 * The new card is on the Checklists screen while it saves, and the
			 * checklist's own screen — which the app goes into once the server
			 * has it — finds it in the cache and draws at once. The refetch after
			 * the write swaps in the server's copy.
			 */
			const createdAt = new Date().toISOString();
			const summary: ChecklistSummary = {
				checklistId: change.checklistId,
				title: change.title,
				description: change.description,
				startDate: change.startDate,
				deadline: change.deadline,
				deadlineTime: change.deadlineTime,
				dailyWindow: change.dailyWindow,
				tagIds: change.tagIds,
				createdAt,
				updatedAt: createdAt,
				progress: { total: 0, completed: 0, percent: 0 },
			};

			client.setQueryData<ChecklistSummary>(
				queryKeys.checklist(change.checklistId),
				summary,
			);
			client.setQueryData<Array<ChecklistSummary>>(
				queryKeys.checklists,
				(list) => (list ? [...list, summary] : list),
			);
			return;
		}

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
