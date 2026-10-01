import { describe, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import type { StagePage } from "#/lib/tasks/tasks";
import { queryKeys } from "#/queries/keys";
import type { ChecklistSummary } from "#/schemas/checklist";
import type { Task, TaskPageView } from "#/schemas/task";
import { invertChange } from "./undo";

const VIEW: TaskPageView = { sort: "newest", limit: 20 };

const STAGES = [
	{ stageId: "todo", name: "To do" },
	{ stageId: "doing", name: "Doing" },
	{ stageId: "review", name: "Review" },
	{ stageId: "done", name: "Done" },
];

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
		stageId: null,
		...partial,
	};
}

/** A browser showing one checklist with four stages, holding these tasks. */
function client(tasks: Array<Task>): QueryClient {
	const queryClient = new QueryClient();
	const checklist: ChecklistSummary = {
		checklistId: "chk_1",
		title: "Work",
		description: "",
		startDate: "2026-01-01",
		deadline: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		stages: STAGES,
		progress: { total: tasks.length, completed: 0, percent: 0, byStage: {} },
	};
	queryClient.setQueryData(queryKeys.checklists, [checklist]);
	queryClient.setQueryData(queryKeys.checklist("chk_1"), checklist);
	queryClient.setQueryData<StagePage>(queryKeys.checklistPage("chk_1", VIEW), {
		items: tasks,
		total: tasks.length,
		page: 1,
		stageId: "todo",
		counts: { todo: tasks.length },
	});
	return queryClient;
}

describe("invertChange", () => {
	it("undoes a tick by naming the stage the task was at", () => {
		const queryClient = client([task({ taskId: "tsk_1" })]);

		const step = invertChange(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { completed: true },
		});

		// "Not done" alone would land it at Review, one short of done.
		expect(step?.changes).toEqual([
			{
				kind: "task.update",
				taskId: "tsk_1",
				patch: {
					stageId: "todo",
					completedAt: null,
					addedAt: "2026-01-01T00:00:00.000Z",
				},
			},
		]);
	});

	it("puts a deleted task back under its number, waited on again", () => {
		const queryClient = client([
			task({ taskId: "tsk_1", number: 42 }),
			task({
				taskId: "tsk_2",
				dependsOn: [{ kind: "task", id: "tsk_1" }],
			}),
		]);

		const step = invertChange(queryClient, {
			kind: "task.delete",
			taskId: "tsk_1",
		});

		expect(step?.changes[0]).toMatchObject({
			kind: "task.create",
			taskId: "tsk_1",
			number: 42,
		});
		expect(step?.changes).toContainEqual({
			kind: "task.update",
			taskId: "tsk_2",
			patch: { dependsOn: [{ kind: "task", id: "tsk_1" }] },
		});
	});

	it("undoes a move back to the stage, place and notes it had", () => {
		const queryClient = client([
			task({ taskId: "tsk_1", stageId: "doing", notes: "call Ana" }),
		]);

		const step = invertChange(queryClient, {
			kind: "task.move",
			taskId: "tsk_1",
			checklistId: "chk_2",
		});

		expect(step?.changes).toEqual([
			{ kind: "task.move", taskId: "tsk_1", checklistId: "chk_1" },
			{
				kind: "task.update",
				taskId: "tsk_1",
				patch: {
					stageId: "doing",
					completedAt: null,
					addedAt: "2026-01-01T00:00:00.000Z",
					notes: "call Ana",
					tagIds: [],
				},
			},
		]);
	});

	it("undoes a batch in one batch, last change first", () => {
		const queryClient = client([
			task({ taskId: "tsk_1" }),
			task({ taskId: "tsk_2", urgent: true }),
		]);

		const step = invertChange(queryClient, {
			kind: "task.batch",
			changes: [
				{ kind: "task.update", taskId: "tsk_1", patch: { urgent: true } },
				{ kind: "task.update", taskId: "tsk_2", patch: { urgent: false } },
			],
		});

		expect(step?.label).toBe("Changes to 2 tasks");
		expect(step?.changes).toEqual([
			{
				kind: "task.batch",
				changes: [
					{ kind: "task.update", taskId: "tsk_2", patch: { urgent: true } },
					{ kind: "task.update", taskId: "tsk_1", patch: { urgent: false } },
				],
			},
		]);
	});
});
