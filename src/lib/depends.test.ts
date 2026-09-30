import { describe, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import type { SearchIndex } from "#/data/search.server";
import { queryKeys } from "#/queries/keys";
import type { Group } from "#/schemas/group";
import type { Task } from "#/schemas/task";
import { whyBlocked } from "./depends";
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
		stageId: "todo",
		...partial,
	};
}

/** A client holding these tasks in the search index, in no checklist. */
function holding(tasks: Array<Task>): QueryClient {
	const client = new QueryClient();
	client.setQueryData<SearchIndex>(queryKeys.searchIndex, {
		checklists: [],
		trackers: [],
		entries: [],
		tasks: tasks.map((each) => ({
			...each,
			checklistId: null,
			checklistTitle: null,
			caption: "",
		})),
	});
	return client;
}

const indexed = (client: QueryClient, taskId: string) =>
	client
		.getQueryData<SearchIndex>(queryKeys.searchIndex)
		?.tasks.find((each) => each.taskId === taskId);

describe("whyBlocked", () => {
	const waiting = task({
		taskId: "tsk_a",
		dependsOn: [{ kind: "task", id: "tsk_b" }],
	});

	it("refuses finishing a task while one it waits on is open", () => {
		const client = holding([
			waiting,
			task({ taskId: "tsk_b", title: "hello" }),
		]);

		expect(
			whyBlocked(client, {
				kind: "task.update",
				taskId: "tsk_a",
				patch: { completed: true },
			}),
		).toBe('Can\'t complete this yet: task "hello" is not done.');
		// Moving it to the last stage is finishing it too.
		expect(
			whyBlocked(client, {
				kind: "task.update",
				taskId: "tsk_a",
				patch: { stageId: "done" },
			}),
		).not.toBeNull();
	});

	it("lets it through once that is done, and lets any other edit through", () => {
		const client = holding([
			waiting,
			task({ taskId: "tsk_b", completed: true }),
		]);
		expect(
			whyBlocked(client, {
				kind: "task.update",
				taskId: "tsk_a",
				patch: { completed: true },
			}),
		).toBeNull();

		const open = holding([waiting, task({ taskId: "tsk_b" })]);
		expect(
			whyBlocked(open, {
				kind: "task.update",
				taskId: "tsk_a",
				patch: { title: "renamed" },
			}),
		).toBeNull();
	});
});

describe("subtasks", () => {
	const sub = (subtaskId: string, done: boolean) => ({
		subtaskId,
		title: subtaskId,
		done,
	});

	it("refuses finishing a task while a subtask is open", () => {
		const client = holding([
			task({
				taskId: "tsk_a",
				subtasks: [sub("sub_1", true), sub("sub_2", false)],
			}),
		]);

		expect(
			whyBlocked(client, {
				kind: "task.update",
				taskId: "tsk_a",
				patch: { completed: true },
			}),
		).toBe("Can't complete this yet: 1 subtask is not done.");
		expect(
			whyBlocked(client, {
				kind: "task.update",
				taskId: "tsk_a",
				patch: { stageId: "done" },
			}),
		).not.toBeNull();
	});

	it("judges by the list the change leaves, and lets other edits through", () => {
		const client = holding([
			task({ taskId: "tsk_a", subtasks: [sub("sub_1", false)] }),
		]);

		// Ticked with the same edit that finishes it.
		expect(
			whyBlocked(client, {
				kind: "task.update",
				taskId: "tsk_a",
				patch: { completed: true, subtasks: [sub("sub_1", true)] },
			}),
		).toBeNull();
		// Adding one to an open task is not finishing it.
		expect(
			whyBlocked(client, {
				kind: "task.update",
				taskId: "tsk_a",
				patch: { subtasks: [sub("sub_1", false), sub("sub_2", false)] },
			}),
		).toBeNull();
	});
});

describe("dependencies on something deleted", () => {
	it("are taken off every task waiting on it at once", () => {
		const client = holding([
			task({
				taskId: "tsk_a",
				dependsOn: [
					{ kind: "task", id: "tsk_b" },
					{ kind: "tag", id: "tag_1" },
				],
			}),
			task({ taskId: "tsk_b" }),
		]);

		applyOptimistically(client, { kind: "task.delete", taskId: "tsk_b" });
		expect(indexed(client, "tsk_a")?.dependsOn).toEqual([
			{ kind: "tag", id: "tag_1" },
		]);

		applyOptimistically(client, { kind: "tag.delete", tagId: "tag_1" });
		expect(indexed(client, "tsk_a")?.dependsOn).toEqual([]);
	});
});

describe("groups", () => {
	it("are made, changed and deleted at once", () => {
		const client = new QueryClient();
		client.setQueryData<Array<Group>>(queryKeys.groups, []);
		const groups = () => client.getQueryData<Array<Group>>(queryKeys.groups);

		applyOptimistically(client, {
			kind: "group.create",
			groupId: "grp_1",
			name: "Launch",
			color: "blue",
			items: [{ kind: "checklist", id: "chk_1" }],
		});
		expect(groups()?.map((each) => each.name)).toEqual(["Launch"]);

		applyOptimistically(client, {
			kind: "group.update",
			groupId: "grp_1",
			patch: {
				name: "Q4 launch",
				items: [
					{ kind: "checklist", id: "chk_1" },
					{ kind: "tracker", id: "trk_1" },
				],
			},
		});
		expect(groups()?.[0].name).toBe("Q4 launch");
		expect(groups()?.[0].items).toHaveLength(2);

		applyOptimistically(client, { kind: "group.delete", groupId: "grp_1" });
		expect(groups()).toEqual([]);
	});
});
