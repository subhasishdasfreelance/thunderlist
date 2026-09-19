/**
 * Showing a change before the server has confirmed it.
 *
 * A tick, a flag, a task typed and entered — these are things the user has
 * already decided. Waiting a round trip to redraw them makes the app feel like
 * it is thinking about whether to agree, so the caches are patched immediately
 * and the request goes out behind it.
 *
 * Every change the app can make is patched here: ticking, flagging, tagging and
 * moving along the stages while reading a list, and equally the things done
 * behind a dialog — a checklist edited, a tracker made, a reading logged, the
 * space's task types rewritten. A dialog closing onto a list that has not
 * changed yet is the same lie as a tick that takes a round trip to appear.
 *
 * What is *not* patched is said where it is skipped, and it is always the same
 * kind of thing: a figure this browser cannot work out from what it holds — the
 * title of a checklist it has never read, the tabs the server groups by — which
 * is left to arrive with the refetch rather than guessed at.
 *
 * Every patch is a guess. It is replaced by the server's answer on the next
 * refetch, and thrown away if the request fails, so a wrong guess is visible
 * for one round trip and never persists.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { AcrossGroup, AcrossPage, AcrossTask } from "#/data/across.server";
import type { SearchIndex } from "#/data/search.server";
import {
	deriveCurrentValue,
	trackerProgress,
	withDeltas,
} from "#/lib/progress";
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
import type { Tag, TagDetail, TagSummary, TagTaskEntry } from "#/schemas/tag";
import type {
	AcrossPageView,
	Task,
	TaskPageView,
	TaskPatch,
} from "#/schemas/task";
import { type TaskType, UNTYPED } from "#/schemas/task-type";
import type { SpaceView } from "#/schemas/team";
import type {
	ProgressEntry,
	Tracker,
	TrackerDetail,
	TrackerSummary,
} from "#/schemas/tracker";

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

/* -------------------------------------------------------------------------- */
/* Whole things                                                               */
/* -------------------------------------------------------------------------- */

/*
 * A checklist, a tracker, a tag: each is held twice over — once on its own key,
 * for the screen about it, and once inside the list every one of them is on.
 * The helpers below change both together, so a title edited in a dialog is the
 * new title on the card behind it as well as on the screen it opens onto.
 */

/** Change one checklist wherever it is held; `null` takes it off the list. */
function patchChecklist(
	client: QueryClient,
	checklistId: string,
	next: (checklist: ChecklistSummary) => ChecklistSummary | null,
): void {
	const held = client.getQueryData<ChecklistSummary>(
		queryKeys.checklist(checklistId),
	);
	const after = held === undefined ? undefined : next(held);
	// One being deleted keeps its own cache until the screen showing it has
	// left; the list is what has to stop offering it now.
	if (after != null) {
		client.setQueryData(queryKeys.checklist(checklistId), after);
	}

	client.setQueryData<Array<ChecklistSummary>>(queryKeys.checklists, (list) =>
		list?.flatMap((checklist) => {
			if (checklist.checklistId !== checklistId) return [checklist];
			const edited = next(checklist);
			return edited === null ? [] : [edited];
		}),
	);
}

/** A tracker's percentage, worked out again from where it now stands. */
function withProgress(tracker: Tracker): TrackerSummary {
	return {
		...tracker,
		progress: trackerProgress(
			tracker.currentValue,
			tracker.targetValue,
			tracker.startValue,
		),
	};
}

/** Change one tracker wherever it is held; `null` takes it off the list. */
function patchTracker(
	client: QueryClient,
	trackerId: string,
	next: (tracker: TrackerSummary) => TrackerSummary | null,
): void {
	const held = client.getQueryData<TrackerDetail>(queryKeys.tracker(trackerId));
	const after = held === undefined ? undefined : next(held);
	if (after != null) client.setQueryData(queryKeys.tracker(trackerId), after);

	client.setQueryData<Array<TrackerSummary>>(queryKeys.trackers, (list) =>
		list?.flatMap((tracker) => {
			if (tracker.trackerId !== trackerId) return [tracker];
			const edited = next(tracker);
			return edited === null ? [] : [edited];
		}),
	);
}

/**
 * A tracker's history after a reading was added, corrected or taken out, with
 * the tracker's own figures brought back in line with it.
 *
 * Every step is measured again from the reading before it, exactly as the
 * server does on each write: a reading entered for last Tuesday drops into the
 * middle of the history and re-spaces its neighbours, so no entry can simply be
 * patched where it sits. `withDeltas` and `deriveCurrentValue` are the same two
 * functions the server answers with, which is why the guess and the answer
 * agree.
 *
 * Nothing is drawn while the history is still on its way. A step measured
 * against readings this browser has not seen would be a number made up, and the
 * read that is already running will bring the real one.
 */
function patchHistory(
	client: QueryClient,
	trackerId: string,
	next: (readings: ReadonlyArray<ProgressEntry>) => Array<ProgressEntry>,
): void {
	const tracker =
		client.getQueryData<TrackerDetail>(queryKeys.tracker(trackerId)) ??
		client
			.getQueryData<Array<TrackerSummary>>(queryKeys.trackers)
			?.find((each) => each.trackerId === trackerId);
	const key = queryKeys.trackerEntries(trackerId);
	const history = client.getQueryData<Array<ProgressEntry>>(key);
	if (tracker === undefined || history === undefined) return;

	const entries = withDeltas(next(history), tracker.startValue);
	client.setQueryData<Array<ProgressEntry>>(key, entries);

	const currentValue = deriveCurrentValue(entries, tracker.startValue);
	patchTracker(client, trackerId, (each) =>
		withProgress({ ...each, currentValue }),
	);
}

/**
 * Change one tag wherever it is held: the list every screen reads it from, the
 * list with the figures on it that only the Tags screen reads, and the tag's
 * own page. `null` takes it out of all of them.
 *
 * A tag's page is keyed by its address rather than its id — Today answers to
 * its kind — so the pages are walked and each asked which tag it is for.
 */
function patchTag(
	client: QueryClient,
	tagId: string,
	next: <T extends Tag>(tag: T) => T | null,
): void {
	const edit = <T extends Tag>(tags: Array<T> | undefined) =>
		tags?.flatMap((tag) => {
			if (tag.tagId !== tagId) return [tag];
			const edited = next(tag);
			return edited === null ? [] : [edited];
		});

	client.setQueryData<Array<Tag>>(queryKeys.tags, edit);
	client.setQueryData<Array<TagSummary>>(queryKeys.tagSummaries, edit);

	for (const [key] of client.getQueriesData({ queryKey: queryKeys.tags })) {
		if (key.length !== 2) continue;

		const detail = client.getQueryData<TagDetail>(key);
		if (detail === undefined || detail.tagId !== tagId) continue;

		const after = next(detail);
		if (after !== null) client.setQueryData<TagDetail>(key, after);
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

		case "checklist.update": {
			const { checklistId, patch } = change;
			const updatedAt = new Date().toISOString();

			patchChecklist(client, checklistId, (checklist) => ({
				...checklist,
				...patch,
				updatedAt,
			}));
			/*
			 * The counts are left as they are. Taking a stage away moves its
			 * tasks back to the one before it, which is a walk over every task in
			 * the list — the server does it in a single write and the refetch
			 * brings the answer. The stages themselves are on screen at once,
			 * which is what was asked for.
			 */
			return;
		}

		case "checklist.delete":
			patchChecklist(client, change.checklistId, () => null);
			return;

		case "tracker.create": {
			const createdAt = new Date().toISOString();
			const tracker = withProgress({
				trackerId: change.trackerId,
				title: change.title,
				type: change.type,
				description: change.description,
				unit: change.unit,
				targetValue: change.targetValue,
				startValue: change.startValue,
				// Nothing has been logged yet, so it stands where it starts.
				currentValue: change.startValue,
				coverUrl: change.coverUrl,
				author: change.author,
				startDate: change.startDate,
				deadline: change.deadline,
				deadlineTime: change.deadlineTime,
				tagIds: change.tagIds,
				assignees: change.assignees,
				access: change.access,
				createdAt,
				updatedAt: createdAt,
			});

			client.setQueryData<TrackerDetail>(
				queryKeys.tracker(change.trackerId),
				tracker,
			);
			client.setQueryData<Array<TrackerSummary>>(queryKeys.trackers, (list) =>
				list === undefined ? list : [...list, tracker],
			);
			// An empty history rather than none, so the screen the app goes into
			// draws its "nothing logged yet" instead of a spinner.
			client.setQueryData<Array<ProgressEntry>>(
				queryKeys.trackerEntries(change.trackerId),
				[],
			);
			return;
		}

		case "tracker.update": {
			const updatedAt = new Date().toISOString();

			/*
			 * Where it stands is not touched, only what that is measured against.
			 * A reading is a fact about the past; moving the target or the
			 * starting point changes the percentage it makes, and nothing else —
			 * which is exactly what the server does with it too.
			 */
			patchTracker(client, change.trackerId, (tracker) =>
				withProgress({ ...tracker, ...change.patch, updatedAt }),
			);
			return;
		}

		case "tracker.delete":
			patchTracker(client, change.trackerId, () => null);
			return;

		case "entry.create": {
			// Who logged it is the server's to stamp; in a team it is what one
			// person's share is counted from, so it is guessed the same way here.
			const recordedBy =
				client.getQueryData<SpaceView>(queryKeys.space)?.email ?? null;

			patchHistory(client, change.trackerId, (history) => [
				...history,
				{
					entryId: change.entryId,
					recordedAt: change.recordedAt,
					value: change.value,
					note: change.note,
					recordedBy,
					// Measured by `patchHistory`, from the reading before it.
					delta: 0,
					updatedAt: new Date().toISOString(),
				},
			]);
			return;
		}

		case "entry.update": {
			const updatedAt = new Date().toISOString();

			patchHistory(client, change.trackerId, (history) =>
				history.map((entry) =>
					entry.entryId === change.entryId
						? { ...entry, ...change.patch, updatedAt }
						: entry,
				),
			);
			return;
		}

		case "entry.delete":
			patchHistory(client, change.trackerId, (history) =>
				history.filter((entry) => entry.entryId !== change.entryId),
			);
			return;

		case "tag.create": {
			const createdAt = new Date().toISOString();
			const tag: Tag = {
				tagId: change.tagId,
				name: change.name,
				color: change.color,
				// Only the ones the account is born with are special, and they are
				// never made from here.
				special: null,
				description: change.description,
				startDate: change.startDate,
				deadline: change.deadline,
				deadlineTime: change.deadlineTime,
				dailyWindow: change.dailyWindow,
				access: change.access,
				createdAt,
				updatedAt: createdAt,
			};

			/*
			 * Drawn at once because a tag is usually born mid-sentence, as `#name`
			 * typed into a task: the chip on that task's row is looked up in this
			 * list, and without the tag in it the row showed the task with its new
			 * tag missing until the refetch.
			 */
			client.setQueryData<Array<Tag>>(queryKeys.tags, (tags) =>
				tags === undefined ? tags : [...tags, tag],
			);
			client.setQueryData<Array<TagSummary>>(
				queryKeys.tagSummaries,
				(summaries) =>
					summaries === undefined
						? summaries
						: [
								...summaries,
								{
									...tag,
									progress: {
										total: 0,
										completed: 0,
										percent: 0,
										inProgress: 0,
									},
								},
							],
			);
			return;
		}

		case "tag.update": {
			const updatedAt = new Date().toISOString();

			patchTag(client, change.tagId, (tag) => ({
				...tag,
				...change.patch,
				updatedAt,
			}));
			return;
		}

		case "tag.delete":
			/*
			 * Off the lists, which is enough for the rows too: a task names its
			 * tags by id and each row looks them up here, so a tag that is no
			 * longer on the list is no longer a chip on anything.
			 */
			patchTag(client, change.tagId, () => null);
			return;

		case "taskTypes.set":
			client.setQueryData<Array<TaskType>>(queryKeys.taskTypes, change.types);
			return;

		default:
			// Everything a change can be is patched above. `task.move` is the one
			// that only half is, and says why where it is handled.
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
