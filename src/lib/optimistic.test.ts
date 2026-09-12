import { describe, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import type { Page } from "#/lib/tasks/tasks";
import { queryKeys } from "#/queries/keys";
import type { ChecklistSummary } from "#/schemas/checklist";
import type { Tag, TagDetail, TagTaskEntry } from "#/schemas/tag";
import type { Task, TaskPageView } from "#/schemas/task";
import { applyOptimistically } from "./optimistic";

/** The first page of what is left to do, as a screen reads it. */
const VIEW: TaskPageView = { sort: "newest", limit: 20 };

function task(partial: Partial<Task> & { taskId: string }): Task {
	return {
		title: partial.taskId,
		completed: false,
		completedAt: null,
		trackerId: null,
		addedAt: "2026-01-01T00:00:00.000Z",
		tagIds: [],
		urgent: false,
		important: false,
		...partial,
	};
}

function summary(checklistId: string): ChecklistSummary {
	return {
		checklistId,
		title: checklistId,
		description: "",
		startDate: "2026-01-01",
		deadline: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		progress: { total: 1, completed: 0, percent: 0 },
	};
}

function tag(tagId: string): Tag {
	return {
		tagId,
		name: tagId,
		color: "blue",
		special: null,
		description: "",
		startDate: null,
		deadline: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};
}

/** A tag's page, counting the given tasks. */
function tagPage(tagId: string, tasks: Array<Task>): TagDetail {
	return {
		...tag(tagId),
		progress: { total: tasks.length, completed: 0, percent: 0 },
		trackers: [],
	};
}

/** A page of rows holding the whole list. */
function page<T>(items: Array<T>): Page<T> {
	return { items, total: items.length };
}

/** Tasks as a tag's page lists them, all from `chk_1`. */
function entries(tasks: Array<Task>): Array<TagTaskEntry> {
	return tasks.map((each) => ({
		task: each,
		checklistId: "chk_1",
		checklistTitle: "chk_1",
	}));
}

/** A client primed the way a running app's is: summaries *and* one screen. */
function client(): QueryClient {
	const queryClient = new QueryClient();

	queryClient.setQueryData<Array<ChecklistSummary>>(queryKeys.checklists, [
		summary("chk_1"),
	]);
	queryClient.setQueryData<ChecklistSummary>(
		queryKeys.checklist("chk_1"),
		summary("chk_1"),
	);
	queryClient.setQueryData<Page<Task>>(
		queryKeys.checklistOpenPage("chk_1", VIEW),
		page([task({ taskId: "tsk_1" })]),
	);

	return queryClient;
}

function checklist(queryClient: QueryClient) {
	return queryClient.getQueryData<ChecklistSummary>(
		queryKeys.checklist("chk_1"),
	);
}

function openTasks(queryClient: QueryClient) {
	return queryClient.getQueryData<Page<Task>>(
		queryKeys.checklistOpenPage("chk_1", VIEW),
	);
}

function tagTasks(queryClient: QueryClient, tagId: string) {
	return queryClient.getQueryData<Page<TagTaskEntry>>(
		queryKeys.tagOpenPage(tagId, VIEW),
	);
}

describe("applyOptimistically", () => {
	/*
	 * `["checklists"]` is the summary list's own key and the first segment of
	 * every other checklist key, so a prefix match hands back an array with no
	 * `progress` on it. Patching that as a checklist threw, which failed the
	 * mutation before it was ever sent: nothing could be changed at all.
	 */
	it("leaves the checklist summaries alone", () => {
		const queryClient = client();

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { completed: true },
		});

		expect(
			queryClient.getQueryData<Array<ChecklistSummary>>(queryKeys.checklists),
		).toEqual([summary("chk_1")]);
	});

	it("ticks the task everywhere it is shown", () => {
		const queryClient = client();

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { completed: true },
		});

		expect(openTasks(queryClient)?.items[0]?.completed).toBe(true);
		expect(checklist(queryClient)?.progress).toEqual({
			total: 1,
			completed: 1,
			percent: 100,
		});
	});

	/*
	 * `["tags"]` is the tag list's key and the first segment of every tag page's,
	 * the same trap as the checklists above: the list must be left alone while
	 * the page holding the task is patched.
	 */
	it("ticks the task on a tag's page and leaves the tag list alone", () => {
		const queryClient = client();
		const tagged = task({ taskId: "tsk_1", tagIds: ["tag_1"] });

		queryClient.setQueryData<Array<Tag>>(queryKeys.tags, [tag("tag_1")]);
		queryClient.setQueryData<TagDetail>(
			queryKeys.tag("tag_1"),
			tagPage("tag_1", [tagged]),
		);
		queryClient.setQueryData(
			queryKeys.tagOpenPage("tag_1", VIEW),
			page(entries([tagged])),
		);

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { completed: true },
		});

		expect(queryClient.getQueryData<Array<Tag>>(queryKeys.tags)).toEqual([
			tag("tag_1"),
		]);
		expect(tagTasks(queryClient, "tag_1")?.items[0]?.task.completed).toBe(true);
		expect(
			queryClient.getQueryData<TagDetail>(queryKeys.tag("tag_1"))?.progress,
		).toEqual({ total: 1, completed: 1, percent: 100 });
	});

	/*
	 * A finished task lives on the page's own read of them, not with the open
	 * ones. Unticked there, it stays put until the refetch — the screen sorts the
	 * reads together — but the counts have to move straight away.
	 */
	it("unticks a finished task where it is and counts it open again", () => {
		const queryClient = client();
		const done = task({ taskId: "tsk_2", completed: true });

		queryClient.setQueryData<ChecklistSummary>(queryKeys.checklist("chk_1"), {
			...summary("chk_1"),
			progress: { total: 2, completed: 1, percent: 50 },
		});
		queryClient.setQueryData<Array<Task>>(
			queryKeys.checklistCompleted("chk_1"),
			[done],
		);

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_2",
			patch: { completed: false },
		});

		expect(
			queryClient.getQueryData<Array<Task>>(
				queryKeys.checklistCompleted("chk_1"),
			)?.[0]?.completed,
		).toBe(false);
		expect(checklist(queryClient)?.progress).toEqual({
			total: 2,
			completed: 0,
			percent: 0,
		});
	});

	it("takes a deleted task out of its checklist, and out of the count", () => {
		const queryClient = client();

		applyOptimistically(queryClient, {
			kind: "task.delete",
			taskId: "tsk_1",
		});

		expect(openTasks(queryClient)).toEqual({ items: [], total: 0 });
	});

	it("takes a moved task out of the checklist it left", () => {
		const queryClient = client();

		applyOptimistically(queryClient, {
			kind: "task.move",
			taskId: "tsk_1",
			checklistId: "chk_2",
		});

		expect(openTasks(queryClient)).toEqual({ items: [], total: 0 });
		expect(checklist(queryClient)?.progress).toEqual({
			total: 0,
			completed: 0,
			percent: 0,
		});
	});

	/*
	 * Pressing the lit bolt on Today's page takes the tag off the task, and the
	 * row should leave the page with it rather than on the refetch.
	 */
	it("drops a task from a tag's page once it no longer carries the tag", () => {
		const queryClient = client();
		const tagged = task({
			taskId: "tsk_1",
			title: "call #today",
			tagIds: ["today"],
		});

		queryClient.setQueryData<Array<Tag>>(queryKeys.tags, [tag("today")]);
		queryClient.setQueryData<TagDetail>(
			queryKeys.tag("today"),
			tagPage("today", [tagged]),
		);
		queryClient.setQueryData(
			queryKeys.tagOpenPage("today", VIEW),
			page(entries([tagged])),
		);

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { title: "call", tagIds: [] },
		});

		expect(tagTasks(queryClient, "today")?.items).toEqual([]);
		expect(
			queryClient.getQueryData<TagDetail>(queryKeys.tag("today"))?.progress,
		).toEqual({ total: 0, completed: 0, percent: 0 });
	});

	it("shows a task typed on a tag's page there at once", () => {
		const queryClient = client();

		queryClient.setQueryData<TagDetail>(
			queryKeys.tag("today"),
			tagPage("today", []),
		);
		queryClient.setQueryData(
			queryKeys.tagOpenPage("today", VIEW),
			page<TagTaskEntry>([]),
		);

		applyOptimistically(queryClient, {
			kind: "task.create",
			checklistId: null,
			taskId: "tsk_2",
			title: "call mum #today",
			addedAt: "2026-01-02T00:00:00.000Z",
			tagIds: ["today"],
			trackerId: null,
			linkedChecklistId: null,
			urgent: false,
			important: false,
		});

		const shown = tagTasks(queryClient, "today");
		expect(shown?.items.map((entry) => entry.task.taskId)).toEqual(["tsk_2"]);
		expect(shown?.items[0]?.checklistId).toBeNull();
		expect(shown?.total).toBe(1);
	});

	/*
	 * An edit sends only the tags written in the title; the server adds the
	 * checklist's back. Drawn before its answer, they must not blink off.
	 */
	it("keeps a task's checklist tags through an edit of its title", () => {
		const queryClient = client();

		queryClient.setQueryData<Array<Tag>>(queryKeys.tags, [
			tag("tag_1"),
			tag("tag_2"),
		]);
		queryClient.setQueryData(
			queryKeys.checklistOpenPage("chk_1", VIEW),
			page([
				task({
					taskId: "tsk_1",
					title: "buy milk #tag_1",
					tagIds: ["tag_1", "tag_2"],
				}),
			]),
		);

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { title: "buy eggs", tagIds: [] },
		});

		// The typed tag went with its text; the inherited one stayed.
		expect(openTasks(queryClient)?.items[0]?.tagIds).toEqual(["tag_2"]);
	});

	it("gives a task added to a checklist that checklist's tags", () => {
		const queryClient = client();

		queryClient.setQueryData<ChecklistSummary>(queryKeys.checklist("chk_1"), {
			...summary("chk_1"),
			tagIds: ["tag_2"],
		});
		queryClient.setQueryData(
			queryKeys.checklistOpenPage("chk_1", VIEW),
			page<Task>([]),
		);

		applyOptimistically(queryClient, {
			kind: "task.create",
			checklistId: "chk_1",
			taskId: "tsk_2",
			title: "new #tag_1",
			addedAt: "2026-01-02T00:00:00.000Z",
			tagIds: ["tag_1"],
			trackerId: null,
			linkedChecklistId: null,
			urgent: false,
			important: false,
		});

		expect(openTasks(queryClient)?.items[0]?.tagIds).toEqual([
			"tag_1",
			"tag_2",
		]);
	});
});
