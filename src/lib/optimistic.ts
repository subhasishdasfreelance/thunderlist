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

import type { QueryClient } from "@tanstack/react-query";
import { unwrittenTags } from "#/lib/tags/inline-tags";
import { queryKeys } from "#/queries/keys";
import type { Change } from "#/schemas/change";
import type {
	ChecklistDetail,
	ChecklistProgress,
	ChecklistSummary,
} from "#/schemas/checklist";
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
 * Change one task on every checklist page in the cache.
 *
 * A page is two caches: the detail, with the open tasks and the counts, and its
 * finished tasks, read later on their own; see `getChecklistCompleted`. The
 * task is changed in whichever holds it and the counts move with it. A tick
 * does not carry it across — the screen sorts the two together, and the next
 * read puts it where it belongs.
 *
 * The keys are walked rather than matched as a prefix: `["checklists"]` is both
 * the summary list's own key and the first segment of every detail key, so a
 * prefix match hands back the summaries — an array, with no `tasks` on it —
 * along with the details this means. A detail key is the two-segment one.
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

		const detail = client.getQueryData<ChecklistDetail>(key);
		const doneKey = queryKeys.checklistCompleted(String(key[1]));
		const done = client.getQueryData<Array<Task>>(doneKey);

		const before = detail?.tasks.find(matches) ?? done?.find(matches);
		if (!detail || !before) continue;

		const after = next(before);
		client.setQueryData<ChecklistDetail>(key, {
			...detail,
			tasks: swap(detail.tasks, matches, after),
			progress: shift(detail.progress, before, after),
		});
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

		const detail = client.getQueryData<TagDetail>(key);
		const doneKey = queryKeys.tagCompleted(String(key[1]));
		const done = client.getQueryData<Array<TagTaskEntry>>(doneKey);

		const before = detail?.tasks.find(matches) ?? done?.find(matches);
		if (!detail || !before) continue;

		const task = next(before.task, detail.tagId);
		const after = task === null ? null : { ...before, task };
		client.setQueryData<TagDetail>(key, {
			...detail,
			tasks: swap(detail.tasks, matches, after),
			progress: shift(detail.progress, before.task, task),
		});
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

		case "task.create": {
			// A task added to a checklist carries its tags as well, just as the
			// server will store it; see `createTask`.
			const inherited =
				change.checklistId === null
					? []
					: (client.getQueryData<ChecklistDetail>(
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
				client.setQueryData<ChecklistDetail>(
					queryKeys.checklist(change.checklistId),
					(detail) =>
						detail
							? {
									...detail,
									tasks: [...detail.tasks, task],
									progress: shift(detail.progress, null, task),
								}
							: detail,
				);
			}

			// A task typed on a tag's page is drawn there at once instead of
			// waiting for a refetch to reveal it. Where it sits is decided by its
			// time, not by its place in this array.
			for (const [key] of client.getQueriesData({ queryKey: queryKeys.tags })) {
				if (key.length !== 2) continue;

				client.setQueryData<TagDetail>(key, (detail) =>
					!detail || !task.tagIds.includes(detail.tagId)
						? detail
						: {
								...detail,
								tasks: [
									{
										task,
										checklistId: change.checklistId,
										// Left to the refetch: a title for a checklist this
										// browser may not have loaded is not something to guess.
										checklistTitle: null,
									},
									...detail.tasks,
								],
								progress: shift(detail.progress, null, task),
							},
				);
			}

			return;
		}

		case "checklist.create": {
			/*
			 * The app goes straight into a checklist the moment it is made, and
			 * that screen asks the server for it — often before the server has
			 * written it, which answered "That checklist no longer exists." for
			 * one that was only just beginning to. Drawn here first, the screen
			 * finds it in the cache instead, and the refetch after the write swaps
			 * in the server's copy.
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

			client.setQueryData<ChecklistDetail>(
				queryKeys.checklist(change.checklistId),
				{ ...summary, tasks: [] },
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
