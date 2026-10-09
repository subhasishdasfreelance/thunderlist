import { describe, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import type { StagePage } from "#/lib/tasks/tasks";
import { queryKeys } from "#/queries/keys";
import type { Change } from "#/schemas/change";
import type { ChecklistSummary } from "#/schemas/checklist";
import type { TagSummary } from "#/schemas/tag";
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

/** A tag on the Tags screen, carried by `total` tasks and trackers. */
function tag(tagId: string, total: number): TagSummary {
	return {
		tagId,
		name: tagId,
		color: "blue",
		special: null,
		description: "",
		startDate: null,
		deadline: null,
		deadlineTime: null,
		dailyWindow: null,
		access: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		progress: { total, completed: 0, percent: 0, inProgress: 0 },
	};
}

/** The same tags, both as every screen reads them and as the Tags screen does. */
function withTags(queryClient: QueryClient, tags: Array<TagSummary>) {
	queryClient.setQueryData(queryKeys.tags, tags);
	queryClient.setQueryData(queryKeys.tagSummaries, tags);
}

const MADE_AGAIN: Change = {
	kind: "tag.create",
	tagId: "tag_1",
	name: "tag_1",
	color: "blue",
	description: "",
	startDate: null,
	startTime: null,
	deadline: null,
	deadlineTime: null,
	dailyWindow: null,
	access: null,
};

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

	it("puts tasks deleted together back in one go, under their numbers", () => {
		const queryClient = client([
			task({ taskId: "tsk_1", number: 7, stageId: "review" }),
			task({ taskId: "tsk_2", number: 8 }),
			task({ taskId: "tsk_3", dependsOn: [{ kind: "task", id: "tsk_1" }] }),
		]);

		const step = invertChange(queryClient, {
			kind: "task.deleteMany",
			taskIds: ["tsk_1", "tsk_2"],
		});

		expect(step?.changes).toMatchObject([
			{
				kind: "task.createMany",
				checklistId: "chk_1",
				tasks: [
					{ taskId: "tsk_1", number: 7 },
					{ taskId: "tsk_2", number: 8 },
				],
			},
			{ kind: "task.update", taskId: "tsk_1", patch: { stageId: "review" } },
			{
				kind: "task.update",
				taskId: "tsk_3",
				patch: { dependsOn: [{ kind: "task", id: "tsk_1" }] },
			},
		]);
		expect(step?.changes).toHaveLength(3);
	});

	it("makes every tag deleted tasks were last to carry in one change", () => {
		const queryClient = client([
			task({ taskId: "tsk_1", tagIds: ["tag_1"] }),
			task({ taskId: "tsk_2", tagIds: ["tag_2"] }),
		]);
		withTags(queryClient, [tag("tag_1", 1), tag("tag_2", 1)]);

		const step = invertChange(queryClient, {
			kind: "task.deleteMany",
			taskIds: ["tsk_1", "tsk_2"],
		});

		const { kind: _, ...madeAgain } = MADE_AGAIN;
		expect(step?.changes[0]).toEqual({
			kind: "tag.createMany",
			tags: [madeAgain, { ...madeAgain, tagId: "tag_2", name: "tag_2" }],
		});
		expect(
			step?.changes.filter((change) => change.kind.startsWith("tag.")),
		).toHaveLength(1);
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
	// Off its last task, the tag was deleted; the undo has to make it again.
	it("makes a tag again before putting it back on its last task", () => {
		const queryClient = client([task({ taskId: "tsk_1", tagIds: ["tag_1"] })]);
		withTags(queryClient, [tag("tag_1", 1)]);

		const step = invertChange(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { tagIds: [] },
		});

		expect(step?.changes).toEqual([
			MADE_AGAIN,
			{ kind: "task.update", taskId: "tsk_1", patch: { tagIds: ["tag_1"] } },
		]);
	});

	it("leaves alone a tag still on other tasks", () => {
		const queryClient = client([task({ taskId: "tsk_1", tagIds: ["tag_1"] })]);
		withTags(queryClient, [tag("tag_1", 2)]);

		const step = invertChange(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { tagIds: [] },
		});

		expect(step?.changes).toEqual([
			{ kind: "task.update", taskId: "tsk_1", patch: { tagIds: ["tag_1"] } },
		]);
	});

	it("counts a batch's tasks together when asking whether a tag emptied", () => {
		const queryClient = client([
			task({ taskId: "tsk_1", tagIds: ["tag_1"] }),
			task({ taskId: "tsk_2", tagIds: ["tag_1"] }),
		]);
		withTags(queryClient, [tag("tag_1", 2)]);

		const step = invertChange(queryClient, {
			kind: "task.batch",
			changes: [
				{ kind: "task.update", taskId: "tsk_1", patch: { tagIds: [] } },
				{ kind: "task.update", taskId: "tsk_2", patch: { tagIds: [] } },
			],
		});

		expect(step?.changes[0]).toEqual(MADE_AGAIN);
		expect(step?.changes).toHaveLength(2);
	});
});
