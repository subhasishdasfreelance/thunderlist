import { describe, expect, it } from "bun:test";
import {
	nextStageId,
	type Stage,
	stageProgress,
	stagesByName,
} from "#/schemas/checklist";
import type { Task } from "#/schemas/task";
import {
	calculateChecklistProgress,
	captionFromChecklist,
	compareTasks,
	mergeReads,
	orderByTask,
	orderTasks,
	pageOf,
	sortTasks,
} from "./tasks";

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

describe("pageOf", () => {
	const ids = ["a", "b", "c", "d", "e"];
	const idOf = (id: string) => id;

	it("sends the first page and says how many there are", () => {
		expect(pageOf(ids, { limit: 2 }, idOf)).toEqual({
			items: ["a", "b"],
			total: 5,
			page: 1,
		});
	});

	it("sends the page asked for, however far in", () => {
		expect(pageOf(ids, { limit: 2, page: 3 }, idOf)).toEqual({
			items: ["e"],
			total: 5,
			page: 3,
		});
	});

	it("opens on the page holding the row to reveal", () => {
		expect(pageOf(ids, { limit: 2, reveal: "d" }, idOf)).toEqual({
			items: ["c", "d"],
			total: 5,
			page: 2,
		});
	});

	it("ignores a row to reveal that is not in the list", () => {
		expect(pageOf(ids, { limit: 2, reveal: "z" }, idOf).page).toBe(1);
	});

	it("lands on the last page when the one asked for is past the end", () => {
		expect(pageOf(ids, { limit: 2, page: 9 }, idOf).page).toBe(3);
		expect(pageOf([], { limit: 2, page: 4 }, idOf)).toEqual({
			items: [],
			total: 0,
			page: 1,
		});
	});
});

describe("orderByTask", () => {
	it("orders rows by the task they carry, as `orderTasks` orders tasks", () => {
		const rows = [
			{ task: task({ taskId: "tsk_1", addedAt: "2026-01-01T00:00:00.000Z" }) },
			{
				task: task({
					taskId: "tsk_2",
					addedAt: "2026-01-02T00:00:00.000Z",
					urgent: true,
				}),
			},
			{ task: task({ taskId: "tsk_3", addedAt: "2026-01-03T00:00:00.000Z" }) },
		];
		const idsIn = (order: "newest" | "priority") =>
			orderByTask(rows, order, (row) => row.task).map((row) => row.task.taskId);

		expect(idsIn("newest")).toEqual(["tsk_3", "tsk_2", "tsk_1"]);
		expect(idsIn("priority")).toEqual(["tsk_2", "tsk_3", "tsk_1"]);
	});

	it("by stage, puts every list's first stage first and done last, the stages between by how far along", () => {
		const three: Array<Stage> = [
			{ stageId: "todo", name: "To do" },
			{ stageId: "review", name: "Review" },
			{ stageId: "done", name: "Done" },
		];
		const four: Array<Stage> = [
			{ stageId: "todo", name: "To do" },
			{ stageId: "dev", name: "Dev" },
			{ stageId: "qa", name: "QA" },
			{ stageId: "done", name: "Done" },
		];
		const rows = [
			{ stages: four, task: task({ taskId: "qa", stageId: "qa" }) },
			{
				stages: three,
				task: task({ taskId: "done", stageId: "done", completed: true }),
			},
			{ stages: three, task: task({ taskId: "review", stageId: "review" }) },
			{ stages: three, task: task({ taskId: "todo-3", stageId: "todo" }) },
			{ stages: four, task: task({ taskId: "dev", stageId: "dev" }) },
		];

		expect(
			orderByTask(
				rows,
				"stage",
				(row) => row.task,
				(row) => stageProgress(row.task, row.stages),
			).map((row) => row.task.taskId),
		).toEqual(["todo-3", "dev", "review", "qa", "done"]);
	});
});

describe("nextStageId", () => {
	const stages: Array<Stage> = [
		{ stageId: "todo", name: "To do" },
		{ stageId: "review", name: "Review" },
		{ stageId: "done", name: "Done" },
	];

	it("goes on one stage, done included", () => {
		expect(nextStageId(task({ taskId: "a", stageId: "todo" }), stages)).toBe(
			"review",
		);
		expect(nextStageId(task({ taskId: "a", stageId: "review" }), stages)).toBe(
			"done",
		);
	});

	it("goes nowhere once done", () => {
		expect(
			nextStageId(
				task({ taskId: "a", stageId: "done", completed: true }),
				stages,
			),
		).toBeNull();
	});

	it("never makes a task following a tracker done by hand", () => {
		expect(
			nextStageId(
				task({ taskId: "a", stageId: "review", trackerId: "trk_1" }),
				stages,
			),
		).toBeNull();
	});
});

describe("stagesByName", () => {
	const review: Array<Stage> = [
		{ stageId: "todo", name: "To do" },
		{ stageId: "review", name: "Review" },
		{ stageId: "done", name: "Done" },
	];
	const qa: Array<Stage> = [
		{ stageId: "open", name: "To Do" },
		{ stageId: "qa", name: "QA" },
		{ stageId: "check", name: "review" },
		{ stageId: "shipped", name: "Done" },
	];
	const at = (
		taskId: string,
		checklistId: string,
		stageId: string | null,
		completed = false,
	) => ({ ...task({ taskId, stageId, completed }), checklistId });

	it("groups every checklist's tasks by stage name, whatever its case, earliest stage first", () => {
		const groups = stagesByName(
			[
				{ checklistId: "a", stages: review },
				{ checklistId: "b", stages: qa },
				{ checklistId: "c" },
			],
			[
				at("1", "a", "review"),
				at("2", "b", "check"),
				at("3", "c", null),
				at("4", "b", "qa"),
				at("5", "a", null, true),
			],
		);

		expect(
			groups.map((group) => [
				group.name,
				group.tasks.map((each) => each.taskId),
			]),
		).toEqual([
			["To do", ["3"]],
			["QA", ["4"]],
			["Review", ["1", "2"]],
			["Done", ["5"]],
		]);
	});

	it("keeps a stage nobody is at, and puts a task from an unknown checklist at the default stages", () => {
		const groups = stagesByName(
			[{ checklistId: "a", stages: review }],
			[at("1", "gone", "whatever")],
		);

		expect(groups.map((group) => [group.name, group.tasks.length])).toEqual([
			["To do", 1],
			["Review", 0],
			["Done", 0],
		]);
	});
});

describe("sortTasks", () => {
	it("puts the newest first", () => {
		const sorted = sortTasks([
			task({ taskId: "b", addedAt: "2026-01-03T00:00:00.000Z" }),
			task({ taskId: "a", addedAt: "2026-01-01T00:00:00.000Z" }),
			task({ taskId: "c", addedAt: "2026-01-02T00:00:00.000Z" }),
		]);

		expect(sorted.map((row) => row.taskId)).toEqual(["b", "c", "a"]);
	});

	it("breaks a tie on the id, which is time-sortable", () => {
		const sorted = sortTasks([
			task({ taskId: "tsk_b", addedAt: "2026-01-01T00:00:00.000Z" }),
			task({ taskId: "tsk_a", addedAt: "2026-01-01T00:00:00.000Z" }),
		]);

		expect(sorted.map((row) => row.taskId)).toEqual(["tsk_b", "tsk_a"]);
	});

	it("puts undated tasks last, in the order they were read in", () => {
		const sorted = sortTasks([
			task({ taskId: "hand_b", addedAt: "" }),
			task({ taskId: "typed", addedAt: "2026-01-01T00:00:00.000Z" }),
			task({ taskId: "hand_a", addedAt: "" }),
		]);

		expect(sorted.map((row) => row.taskId)).toEqual([
			"typed",
			"hand_b",
			"hand_a",
		]);
	});

	it("does not mutate its input", () => {
		const tasks = [
			task({ taskId: "b", addedAt: "2026-01-03T00:00:00.000Z" }),
			task({ taskId: "a", addedAt: "2026-01-01T00:00:00.000Z" }),
		];

		sortTasks(tasks);

		expect(tasks[0].taskId).toBe("b");
	});
});

describe("compareTasks", () => {
	it("treats two undated tasks as equal so their read order survives", () => {
		expect(
			compareTasks(
				task({ taskId: "a", addedAt: "" }),
				task({ taskId: "b", addedAt: "" }),
			),
		).toBe(0);
	});
});

describe("calculateChecklistProgress", () => {
	it("counts completed against total", () => {
		expect(
			calculateChecklistProgress([
				task({ taskId: "a", completed: true }),
				task({ taskId: "b" }),
				task({ taskId: "c", completed: true }),
				task({ taskId: "d" }),
			]),
		).toEqual({ total: 4, completed: 2, percent: 50 });
	});

	it("is zero for an empty checklist rather than dividing by zero", () => {
		expect(calculateChecklistProgress([])).toEqual({
			total: 0,
			completed: 0,
			percent: 0,
		});
	});

	it("rounds to a whole percent", () => {
		expect(
			calculateChecklistProgress([
				task({ taskId: "a", completed: true }),
				task({ taskId: "b" }),
				task({ taskId: "c" }),
			]).percent,
		).toBe(33);
	});
});

describe("orderTasks by priority", () => {
	const at = (day: number) => `2026-01-0${day}T00:00:00.000Z`;

	it("puts both first, then urgent, then important, then the rest", () => {
		const ordered = orderTasks(
			[
				task({ taskId: "plain", addedAt: at(1) }),
				task({ taskId: "important", addedAt: at(2), important: true }),
				task({ taskId: "urgent", addedAt: at(3), urgent: true }),
				task({
					taskId: "both",
					addedAt: at(4),
					urgent: true,
					important: true,
				}),
			],
			"priority",
		);

		expect(ordered.map((row) => row.taskId)).toEqual([
			"both",
			"urgent",
			"important",
			"plain",
		]);
	});

	it("keeps the newest first inside a band", () => {
		const ordered = orderTasks(
			[
				task({ taskId: "older", addedAt: at(1), urgent: true }),
				task({ taskId: "newer", addedAt: at(3), urgent: true }),
			],
			"priority",
		);

		expect(ordered.map((row) => row.taskId)).toEqual(["newer", "older"]);
	});

	it("leaves the order alone when sorting by newest", () => {
		const tasks = [
			task({ taskId: "plain", addedAt: at(3) }),
			task({ taskId: "both", addedAt: at(1), urgent: true, important: true }),
		];

		expect(orderTasks(tasks, "newest").map((row) => row.taskId)).toEqual([
			"plain",
			"both",
		]);
	});

	it("does not mutate its input", () => {
		const tasks = [
			task({ taskId: "a", addedAt: at(1) }),
			task({ taskId: "b", addedAt: at(2), urgent: true }),
		];

		orderTasks(tasks, "priority");

		expect(tasks.map((row) => row.taskId)).toEqual(["a", "b"]);
	});
});

describe("mergeReads", () => {
	const id = (row: { id: string }) => row.id;

	it("puts the open tasks and the finished ones together", () => {
		expect(mergeReads([{ id: "a" }], [{ id: "b" }], id)).toEqual([
			{ id: "a" },
			{ id: "b" },
		]);
	});

	it("keeps a task in both reads once, as the open read has it", () => {
		// Ticked on screen: the open read has the change, the other is stale.
		const merged = mergeReads(
			[{ id: "a", done: true }],
			[{ id: "a", done: false }],
			id,
		);

		expect(merged).toEqual([{ id: "a", done: true }]);
	});
});

const LISTS = ["Design system", "Inbox", "Q3 launch"];

describe("captionFromChecklist", () => {
	it("is the checklist's name, with nothing in front of it", () => {
		expect(captionFromChecklist("", "Design system", LISTS)).toBe(
			"Design system",
		);
	});

	it("keeps what the task already said, after where it came from", () => {
		expect(captionFromChecklist("waiting on Ana", "Inbox", LISTS)).toBe(
			"Inbox · waiting on Ana",
		);
	});

	/*
	 * With no "From " in front of it there is nothing in the text marking the
	 * origin, so an earlier one is recognised by being a checklist's name.
	 */
	it("replaces where it came from last time rather than stacking them up", () => {
		expect(
			captionFromChecklist("Design system · waiting on Ana", "Inbox", LISTS),
		).toBe("Inbox · waiting on Ana");
	});

	it("leaves a note alone that is nobody's checklist", () => {
		expect(captionFromChecklist("waiting on Ana", "Inbox", [])).toBe(
			"Inbox · waiting on Ana",
		);
	});
});
