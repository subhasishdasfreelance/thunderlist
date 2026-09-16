/**
 * Showing a change before the server has confirmed it.
 *
 * A tick, a flag, a task typed and entered — these are things the user has
 * already decided. Waiting a round trip to redraw them makes the app feel like
 * it is thinking about whether to agree, so the caches are patched immediately
 * and the request goes out behind it.
 *
 * Only the changes made *while reading a list* are patched here: ticking,
 * flagging, tagging, moving along the stages, adding and removing. The rest —
 * editing a checklist, creating a tracker — happen in a dialog that closes
 * anyway, where a moment's wait costs nothing and a second copy of the write
 * logic would. Creating a checklist is the exception, because the app goes
 * straight into the new one; see below.
 *
 * Every patch is a guess. It is replaced by the server's answer on the next
 * refetch, and thrown away if the request fails, so a wrong guess is visible
 * for one round trip and never persists.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { AcrossGroup, AcrossPage, AcrossTask } from "#/data/across.server";
import type { SearchIndex } from "#/data/search.server";
import { unwrittenTags } from "#/lib/tags/inline-tags";
import { matchesFilter, type Page, type StagePage } from "#/lib/tasks/tasks";
import { queryKeys } from "#/queries/keys";
import type { TaggedTask } from "#/queries/system";
import type { Change } from "#/schemas/change";
import {
	type ChecklistProgress,
	type ChecklistSummary,
	checklistStages,
	DEFAULT_STAGES,
	isUnderway,
	type Stage,
	stageOf,
} from "#/schemas/checklist";
import type { Tag, TagDetail, TagTaskEntry } from "#/schemas/tag";
import type {
	AcrossPageView,
	Task,
	TaskPageView,
	TaskPatch,
} from "#/schemas/task";
import { UNTYPED } from "#/schemas/task-type";

/**
 * A list's counts, moved by one task arriving, leaving or being ticked.
 *
 * Moved rather than recounted: a page holds a page of its tasks, not the whole
 * list to count. `null` is a task not there — before it arrived, after it
 * left. Any other counts the progress carries are kept as they were, for the
 * caller to move.
 */
function shift<P extends ChecklistProgress>(
	progress: P,
	before: Pick<Task, "completed"> | null,
	after: Pick<Task, "completed"> | null,
): P {
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
		...progress,
		total,
		completed,
		percent: total === 0 ? 0 : Math.round((completed / total) * 100),
	};
}

/**
 * A checklist's counts at each stage, with one task gone from `from` and
 * arrived at `to` — `null` for not there, before it arrived or after it left.
 */
function moveStage(
	byStage: Readonly<Record<string, number>>,
	from: string | null,
	to: string | null,
): Record<string, number> {
	const next = { ...byStage };
	if (from !== null) next[from] = Math.max(0, (next[from] ?? 0) - 1);
	if (to !== null) next[to] = (next[to] ?? 0) + 1;
	return next;
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
 * `null`. A row taken out comes off the count too, so the page numbers do not
 * promise one that is no longer there.
 */
function swapInPage<T, P extends Page<T>>(
	page: P,
	matches: (item: T) => boolean,
	next: T | null,
): P {
	const items = swap(page.items, matches, next);
	return {
		...page,
		items,
		total: page.total - (page.items.length - items.length),
	};
}

/** The screen's view a page was read with: the last segment of its key. */
function viewOf(key: ReadonlyArray<unknown>): TaskPageView {
	return key[key.length - 1] as TaskPageView;
}

/** A checklist's stages, from whichever of its caches this browser holds. */
function stagesOf(
	client: QueryClient,
	checklistId: string | null,
): ReadonlyArray<Stage> {
	if (checklistId === null) return DEFAULT_STAGES;

	const checklist =
		client.getQueryData<ChecklistSummary>(queryKeys.checklist(checklistId)) ??
		client
			.getQueryData<Array<ChecklistSummary>>(queryKeys.checklists)
			?.find((each) => each.checklistId === checklistId);

	return checklistStages(checklist ?? {});
}

/**
 * A task after an edit, with its stage and its tick agreeing: reaching the
 * last stage is finishing it, a tick moves it there, and unticking moves it
 * back to the stage before; see `updateTask`.
 */
function settle(
	task: Task,
	patch: TaskPatch,
	stages: ReadonlyArray<Stage>,
): Task {
	const last = stages[stages.length - 1].stageId;

	if (patch.stageId !== undefined) {
		return {
			...task,
			stageId: patch.stageId,
			completed: patch.stageId === last,
		};
	}
	if (patch.completed !== undefined) {
		return {
			...task,
			stageId: patch.completed ? last : stages[stages.length - 2].stageId,
		};
	}
	return task;
}

/**
 * Change one task on every checklist page in the cache.
 *
 * A checklist's screen is several caches: the checklist, with the counts; its
 * tasks, a stage and a page at a time, each with how many tasks are at every
 * stage; and its finished tasks, read whole for the chart. The task is changed
 * wherever it is held and the counts move with it. One that has moved to
 * another stage — or out of a page's filter — leaves that page at once.
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
	next: (task: Task, checklistId: string) => Task | null,
): void {
	const matches = (task: Task) => task.taskId === taskId;

	for (const [key] of client.getQueriesData({
		queryKey: queryKeys.checklists,
	})) {
		if (key.length !== 2) continue;

		const checklistId = String(key[1]);
		const checklist = client.getQueryData<ChecklistSummary>(key);
		const pages = client.getQueriesData<StagePage>({
			queryKey: queryKeys.checklistPages(checklistId),
		});
		const doneKey = queryKeys.checklistCompleted(checklistId);
		const done = client.getQueryData<Array<Task>>(doneKey);

		const before =
			pages.flatMap(([, page]) => page?.items ?? []).find(matches) ??
			done?.find(matches);
		if (!checklist || !before) continue;

		const stages = checklistStages(checklist);
		const after = next(before, checklistId);
		const from = stageOf(before, stages);
		const to = after === null ? null : stageOf(after, stages);

		client.setQueryData<ChecklistSummary>(key, {
			...checklist,
			progress: {
				...shift(checklist.progress, before, after),
				byStage: moveStage(checklist.progress.byStage, from, to),
			},
		});

		for (const [pageKey, page] of pages) {
			if (!page) continue;
			const view = viewOf(pageKey);

			const counts = { ...page.counts };
			if (matchesFilter(before, view)) {
				counts[from] = Math.max(0, (counts[from] ?? 0) - 1);
			}
			if (after !== null && to !== null && matchesFilter(after, view)) {
				counts[to] = (counts[to] ?? 0) + 1;
			}

			const stays =
				after !== null && to === page.stageId && matchesFilter(after, view);
			client.setQueryData<StagePage>(pageKey, {
				...swapInPage(page, matches, stays ? after : null),
				counts,
			});
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
	next: (task: Task, tagId: string, checklistId: string | null) => Task | null,
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

		const task = next(before.task, detail.tagId, before.checklistId);
		const after = task === null ? null : { ...before, task };
		// Moving along its stages moves it in and out of the part under way.
		const stages = stagesOf(client, before.checklistId);
		const underway = (each: Task | null) =>
			each !== null && isUnderway(each, stages) ? 1 : 0;
		client.setQueryData<TagDetail>(key, {
			...detail,
			progress: {
				...shift(detail.progress, before.task, task),
				inProgress: Math.max(
					0,
					(detail.progress.inProgress ?? 0) +
						underway(task) -
						underway(before.task),
				),
			},
		});
		for (const [pageKey, page] of pages) {
			if (page) client.setQueryData(pageKey, swapInPage(page, matches, after));
		}
		if (done) client.setQueryData(doneKey, swap(done, matches, after));
	}
}

/**
 * The group a task falls into under one cut, as the server grouped it.
 *
 * Cut by stage that is the name of the stage it is at, lowercased, since names
 * are what checklists share; cut by type it is its type's id, or the group the
 * untyped fall into — which is also where a type the space no longer has puts
 * it, so `groups` is what decides whether an id is still one.
 */
function acrossGroupOf(
	task: AcrossTask,
	view: AcrossPageView,
	groups: ReadonlyArray<AcrossGroup>,
	stages: ReadonlyArray<Stage>,
): string {
	if (view.groupBy === "type") {
		const typeId = task.typeId ?? UNTYPED;
		return groups.some((group) => group.key === typeId) ? typeId : UNTYPED;
	}

	const at = stageOf(task, stages);
	return (
		stages.find((stage) => stage.stageId === at)?.name ?? ""
	).toLowerCase();
}

/** A group's counts with one task gone from `from` and arrived at `to`. */
function moveGroup(
	groups: ReadonlyArray<AcrossGroup>,
	from: string | null,
	to: string | null,
): Array<AcrossGroup> {
	return groups.map((group) => ({
		...group,
		count: Math.max(
			0,
			group.count - (group.key === from ? 1 : 0) + (group.key === to ? 1 : 0),
		),
	}));
}

/**
 * The same, on every page of the Across lists screen. A task that has moved to
 * another group — ticked on to the next stage, given another type — or out of
 * the page's filter leaves the rows now and is counted under its new tab.
 */
function patchAcross(
	client: QueryClient,
	taskId: string,
	next: (task: AcrossTask) => AcrossTask | null,
): void {
	const matches = (task: AcrossTask) => task.taskId === taskId;

	for (const [key, page] of client.getQueriesData<AcrossPage>({
		queryKey: queryKeys.across,
	})) {
		if (!page) continue;

		const before = page.items.find(matches);
		if (!before) continue;

		const view = viewOf(key) as AcrossPageView;
		const after = next(before);
		const stages = stagesOf(client, before.checklistId);
		const from = acrossGroupOf(before, view, page.groups, stages);
		const to =
			after === null || !matchesFilter(after, view)
				? null
				: acrossGroupOf(after, view, page.groups, stages);

		client.setQueryData<AcrossPage>(key, {
			...swapInPage(page, matches, to === page.key ? after : null),
			groups: moveGroup(page.groups, from, to),
		});
	}
}

/**
 * A task arriving, on every page of the Across lists screen: counted under the
 * tab it belongs to, and drawn when that is the tab being read.
 */
function addToAcrossPages(client: QueryClient, task: AcrossTask): void {
	for (const [key, page] of client.getQueriesData<AcrossPage>({
		queryKey: queryKeys.across,
	})) {
		if (!page) continue;

		const view = viewOf(key) as AcrossPageView;
		if (!matchesFilter(task, view)) continue;

		const group = acrossGroupOf(
			task,
			view,
			page.groups,
			stagesOf(client, task.checklistId),
		);
		const isHere = group === page.key;

		client.setQueryData<AcrossPage>(key, {
			...page,
			groups: moveGroup(page.groups, null, group),
			items: isHere && page.page === 1 ? [...page.items, task] : page.items,
			total: isHere ? page.total + 1 : page.total,
		});
	}
}

/**
 * The same, in the search index, which the Priority screen lists from. `next`
 * returns `null` to take the task out.
 */
function patchSearchIndex(
	client: QueryClient,
	taskId: string,
	next: (task: TaggedTask) => TaggedTask | null,
): void {
	client.setQueryData<SearchIndex>(queryKeys.searchIndex, (index) =>
		index
			? {
					...index,
					tasks: index.tasks.flatMap((task) => {
						if (task.taskId !== taskId) return [task];
						const after = next(task);
						return after === null ? [] : [after];
					}),
				}
			: index,
	);
}

/**
 * One task as this browser last drew it, from whichever list it is in, with
 * the checklist it belongs to.
 *
 * Every screen holds its tasks in a cache of its own shape, so this looks in
 * each in turn and takes the first answer. It is how a change is worked out to
 * be the undo of another: what a task was before an edit is only known from
 * the copy on screen a moment earlier; see `invertChange`.
 */
export function findCachedTask(
	client: QueryClient,
	taskId: string,
): { task: Task; checklistId: string | null } | null {
	const indexed = client
		.getQueryData<SearchIndex>(queryKeys.searchIndex)
		?.tasks.find((task) => task.taskId === taskId);
	if (indexed) return { task: indexed, checklistId: indexed.checklistId };

	for (const [, page] of client.getQueriesData<AcrossPage>({
		queryKey: queryKeys.across,
	})) {
		const found = page?.items.find((task) => task.taskId === taskId);
		if (found) return { task: found, checklistId: found.checklistId };
	}

	for (const [key] of client.getQueriesData({
		queryKey: queryKeys.checklists,
	})) {
		if (key.length !== 2) continue;

		const checklistId = String(key[1]);
		const found =
			client
				.getQueriesData<StagePage>({
					queryKey: queryKeys.checklistPages(checklistId),
				})
				.flatMap(([, page]) => page?.items ?? [])
				.find((task) => task.taskId === taskId) ??
			client
				.getQueryData<Array<Task>>(queryKeys.checklistCompleted(checklistId))
				?.find((task) => task.taskId === taskId);
		if (found) return { task: found, checklistId };
	}

	for (const [key] of client.getQueriesData({ queryKey: queryKeys.tags })) {
		if (key.length !== 2) continue;

		const address = String(key[1]);
		const found =
			client
				.getQueriesData<Page<TagTaskEntry>>({
					queryKey: queryKeys.tagOpen(address),
				})
				.flatMap(([, page]) => page?.items ?? [])
				.find((entry) => entry.task.taskId === taskId) ??
			client
				.getQueryData<Array<TagTaskEntry>>(queryKeys.tagCompleted(address))
				?.find((entry) => entry.task.taskId === taskId);
		if (found) return { task: found.task, checklistId: found.checklistId };
	}

	return null;
}

/** Change one task wherever it is shown. */
function patchTask(
	client: QueryClient,
	taskId: string,
	change: (task: Task, checklistId: string | null) => Task,
): void {
	patchChecklists(client, taskId, change);

	// A tag's page shows the tasks carrying it, so one that has just lost the
	// tag — taken off Today with the bolt — leaves the page now, not on the
	// refetch.
	patchTags(client, taskId, (task, tagId, checklistId) => {
		const next = change(task, checklistId);
		return next.tagIds.includes(tagId) ? next : null;
	});

	patchSearchIndex(client, taskId, (task) => ({
		...task,
		...change(task, task.checklistId),
	}));

	patchAcross(client, taskId, (task) => ({
		...task,
		...change(task, task.checklistId),
	}));
}

function dropTask(client: QueryClient, taskId: string): void {
	patchChecklists(client, taskId, () => null);
	patchTags(client, taskId, () => null);
	patchSearchIndex(client, taskId, () => null);
	patchAcross(client, taskId, () => null);
}

/**
 * A task arriving in a checklist: at its first stage, on the first page, where
 * a newest-first list puts it — and counted on every page whose filter it
 * passes. Where it sits among the rows is the screen's order to decide.
 */
function addToChecklistPages(
	client: QueryClient,
	checklistId: string,
	task: Task,
): void {
	const first = stagesOf(client, checklistId)[0].stageId;

	for (const [key, page] of client.getQueriesData<StagePage>({
		queryKey: queryKeys.checklistPages(checklistId),
	})) {
		if (!page || !matchesFilter(task, viewOf(key))) continue;

		const isHere = page.stageId === first;
		client.setQueryData<StagePage>(key, {
			...page,
			counts: { ...page.counts, [first]: (page.counts[first] ?? 0) + 1 },
			items: isHere && page.page === 1 ? [...page.items, task] : page.items,
			total: isHere ? page.total + 1 : page.total,
		});
	}
}

/**
 * A task arriving on a tag's page. A page of one person's tasks is left alone,
 * in a team: a task just added is nobody's yet, so it does not belong there.
 */
function addToTagPages(
	client: QueryClient,
	address: string,
	entry: TagTaskEntry,
): void {
	for (const [key, page] of client.getQueriesData<Page<TagTaskEntry>>({
		queryKey: queryKeys.tagOpen(address),
	})) {
		if (!page || viewOf(key).assignee !== undefined) continue;

		client.setQueryData<Page<TagTaskEntry>>(key, {
			...page,
			items: page.page === 1 ? [...page.items, entry] : page.items,
			total: page.total + 1,
		});
	}
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
			const { patch } = change;

			patchTask(client, change.taskId, (task, checklistId) =>
				settle(
					{
						...task,
						...patch,
						// The server adds a task's checklist tags back to whatever an
						// edit sends. Keeping the ones its title never wrote does the
						// same here, so their chips do not blink off until the answer
						// lands.
						tagIds:
							patch.tagIds === undefined
								? task.tagIds
								: [
										...new Set([
											...patch.tagIds,
											...unwrittenTags(task.title, task.tagIds, tags).map(
												(tag) => tag.tagId,
											),
										]),
									],
					},
					patch,
					stagesOf(client, checklistId),
				),
			);

			// The server stamps the moment it was finished; guessing it here keeps
			// the chart from re-drawing when the answer lands.
			patchTask(client, change.taskId, (task) =>
				task.completedAt === null && task.completed
					? { ...task, completedAt: new Date().toISOString() }
					: !task.completed && task.completedAt !== null
						? { ...task, completedAt: null }
						: task,
			);
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

			const first = stagesOf(client, change.checklistId)[0].stageId;
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
				stageId: first,
			};

			if (change.checklistId !== null) {
				client.setQueryData<ChecklistSummary>(
					queryKeys.checklist(change.checklistId),
					(checklist) =>
						checklist
							? {
									...checklist,
									progress: {
										...shift(checklist.progress, null, task),
										byStage: moveStage(checklist.progress.byStage, null, first),
									},
								}
							: checklist,
				);
				addToChecklistPages(client, change.checklistId, task);
			}

			// The Across lists screen gathers every task, so one just added is one
			// of them whichever checklist it went into.
			addToAcrossPages(client, {
				...task,
				checklistId: change.checklistId,
				// Left to the refetch, as on a tag's page: a title for a checklist
				// this browser may not hold — or the Inbox it lands in — is not
				// something to guess.
				checklistTitle: null,
				caption: "",
			});

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
				addToTagPages(client, String(key[1]), {
					task,
					checklistId: change.checklistId,
					// Left to the refetch: a title for a checklist this browser may
					// not have loaded — or the Inbox it lands in — is not something
					// to guess.
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
				access: change.access,
				stages: change.stages,
				createdAt,
				updatedAt: createdAt,
				progress: { total: 0, completed: 0, percent: 0, byStage: {} },
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
