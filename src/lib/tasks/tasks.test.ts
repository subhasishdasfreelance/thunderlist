import { describe, expect, it } from "bun:test";
import type { Task } from "#/schemas/task";
import {
	calculateChecklistProgress,
	compareTasks,
	orderTasks,
	sortTasks,
} from "./tasks";

function task(partial: Partial<Task> & { taskId: string }): Task {
	return {
		title: partial.taskId,
		completed: false,
		addedAt: "2026-01-01T00:00:00.000Z",
		tagIds: [],
		urgent: false,
		important: false,
		...partial,
	};
}

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
