import { describe, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/queries/keys";
import type { ChecklistDetail, ChecklistSummary } from "#/schemas/checklist";
import type { Task } from "#/schemas/task";
import type { TaskRefEntry } from "#/schemas/task-list";
import { applyOptimistically } from "./optimistic";

function task(partial: Partial<Task> & { taskId: string }): Task {
	return {
		title: partial.taskId,
		completed: false,
		completedAt: null,
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
		status: null,
	};
}

function entry(taskId: string): TaskRefEntry {
	return {
		item: {
			itemId: `itm_${taskId}`,
			taskId,
			sortOrder: 1,
			addedAt: "2026-01-01T00:00:00.000Z",
		},
		list: "today",
		checklistId: "chk_1",
		checklistTitle: "chk_1",
		task: task({ taskId }),
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

	queryClient.setQueryData(queryKeys.taskLists, {
		today: [entry("tsk_1")],
		backlog: [],
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

		const lists = queryClient.getQueryData<{ today: Array<TaskRefEntry> }>(
			queryKeys.taskLists,
		);
		expect(lists?.today[0]?.task?.completed).toBe(true);
	});

	it("takes a deleted task out of both", () => {
		const queryClient = client();

		applyOptimistically(queryClient, {
			kind: "task.delete",
			taskId: "tsk_1",
		});

		expect(
			queryClient.getQueryData<ChecklistDetail>(queryKeys.checklist("chk_1"))
				?.tasks,
		).toEqual([]);
		expect(
			queryClient.getQueryData<{ today: Array<TaskRefEntry> }>(
				queryKeys.taskLists,
			)?.today,
		).toEqual([]);
	});
});
