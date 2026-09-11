import { describe, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/queries/keys";
import type { ChecklistDetail, ChecklistSummary } from "#/schemas/checklist";
import type { Tag, TagDetail } from "#/schemas/tag";
import type { Task } from "#/schemas/task";
import { applyOptimistically } from "./optimistic";

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

/** A tag's page, holding the given tasks, all from `chk_1`. */
function tagPage(tagId: string, tasks: Array<Task>): TagDetail {
	return {
		...tag(tagId),
		progress: { total: tasks.length, completed: 0, percent: 0 },
		tasks: tasks.map((each) => ({
			task: each,
			checklistId: "chk_1",
			checklistTitle: "chk_1",
		})),
		trackers: [],
	};
}

/** A client primed the way a running app's is: summaries *and* one detail. */
function client(): QueryClient {
	const queryClient = new QueryClient();

	queryClient.setQueryData<Array<ChecklistSummary>>(queryKeys.checklists, [
		summary("chk_1"),
	]);

	queryClient.setQueryData<ChecklistDetail>(queryKeys.checklist("chk_1"), {
		...summary("chk_1"),
		tasks: [task({ taskId: "tsk_1" })],
	});

	return queryClient;
}

describe("applyOptimistically", () => {
	/*
	 * `["checklists"]` is the summary list's own key and the first segment of
	 * every detail key, so a prefix match hands back an array with no `tasks` on
	 * it. Patching that as a detail threw, which failed the mutation before it
	 * was ever sent: nothing could be changed at all.
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

		const detail = queryClient.getQueryData<ChecklistDetail>(
			queryKeys.checklist("chk_1"),
		);
		expect(detail?.tasks[0]?.completed).toBe(true);
		expect(detail?.progress).toEqual({ total: 1, completed: 1, percent: 100 });
	});

	/*
	 * `["tags"]` is the tag list's key and the first segment of every tag page's,
	 * the same trap as the checklists above: the list must be left alone while
	 * the page holding the task is patched.
	 */
	it("ticks the task on a tag's page and leaves the tag list alone", () => {
		const queryClient = client();

		queryClient.setQueryData<Array<Tag>>(queryKeys.tags, [tag("tag_1")]);
		queryClient.setQueryData<TagDetail>(
			queryKeys.tag("tag_1"),
			tagPage("tag_1", [task({ taskId: "tsk_1", tagIds: ["tag_1"] })]),
		);

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { completed: true },
		});

		expect(queryClient.getQueryData<Array<Tag>>(queryKeys.tags)).toEqual([
			tag("tag_1"),
		]);

		const detail = queryClient.getQueryData<TagDetail>(queryKeys.tag("tag_1"));
		expect(detail?.tasks[0]?.task.completed).toBe(true);
		expect(detail?.progress).toEqual({ total: 1, completed: 1, percent: 100 });
	});

	/*
	 * A finished task lives on the page's second read, not the detail. Unticked
	 * there, it stays put until the refetch — the screen sorts the two reads
	 * together — but the counts on the detail have to move straight away.
	 */
	it("unticks a finished task where it is and counts it open again", () => {
		const queryClient = client();
		const done = task({ taskId: "tsk_2", completed: true });

		queryClient.setQueryData<ChecklistDetail>(queryKeys.checklist("chk_1"), {
			...summary("chk_1"),
			progress: { total: 2, completed: 1, percent: 50 },
			tasks: [task({ taskId: "tsk_1" })],
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
		expect(
			queryClient.getQueryData<ChecklistDetail>(queryKeys.checklist("chk_1"))
				?.progress,
		).toEqual({ total: 2, completed: 0, percent: 0 });
	});

	it("takes a deleted task out of its checklist", () => {
		const queryClient = client();

		applyOptimistically(queryClient, {
			kind: "task.delete",
			taskId: "tsk_1",
		});

		expect(
			queryClient.getQueryData<ChecklistDetail>(queryKeys.checklist("chk_1"))
				?.tasks,
		).toEqual([]);
	});

	/*
	 * Pressing the lit bolt on Today's page takes the tag off the task, and the
	 * row should leave the page with it rather than on the refetch.
	 */
	it("drops a task from a tag's page once it no longer carries the tag", () => {
		const queryClient = client();

		queryClient.setQueryData<Array<Tag>>(queryKeys.tags, [tag("today")]);
		queryClient.setQueryData<TagDetail>(
			queryKeys.tag("today"),
			tagPage("today", [
				task({ taskId: "tsk_1", title: "call #today", tagIds: ["today"] }),
			]),
		);

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { title: "call", tagIds: [] },
		});

		const page = queryClient.getQueryData<TagDetail>(queryKeys.tag("today"));
		expect(page?.tasks).toEqual([]);
		expect(page?.progress).toEqual({ total: 0, completed: 0, percent: 0 });
	});

	it("shows a task typed on a tag's page there at once", () => {
		const queryClient = client();

		queryClient.setQueryData<TagDetail>(
			queryKeys.tag("today"),
			tagPage("today", []),
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

		const page = queryClient.getQueryData<TagDetail>(queryKeys.tag("today"));
		expect(page?.tasks.map((entry) => entry.task.taskId)).toEqual(["tsk_2"]);
		expect(page?.tasks[0]?.checklistId).toBeNull();
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
		queryClient.setQueryData<ChecklistDetail>(queryKeys.checklist("chk_1"), {
			...summary("chk_1"),
			tasks: [
				task({
					taskId: "tsk_1",
					title: "buy milk #tag_1",
					tagIds: ["tag_1", "tag_2"],
				}),
			],
		});

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { title: "buy eggs", tagIds: [] },
		});

		// The typed tag went with its text; the inherited one stayed.
		expect(
			queryClient.getQueryData<ChecklistDetail>(queryKeys.checklist("chk_1"))
				?.tasks[0]?.tagIds,
		).toEqual(["tag_2"]);
	});

	it("gives a task added to a checklist that checklist's tags", () => {
		const queryClient = client();

		queryClient.setQueryData<ChecklistDetail>(queryKeys.checklist("chk_1"), {
			...summary("chk_1"),
			tagIds: ["tag_2"],
			tasks: [],
		});

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

		expect(
			queryClient.getQueryData<ChecklistDetail>(queryKeys.checklist("chk_1"))
				?.tasks[0]?.tagIds,
		).toEqual(["tag_1", "tag_2"]);
	});
});
