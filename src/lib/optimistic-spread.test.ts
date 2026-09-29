import { describe, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import type { SearchIndex } from "#/data/search.server";
import type { Page } from "#/lib/tasks/tasks";
import { queryKeys } from "#/queries/keys";
import type { ChecklistSummary } from "#/schemas/checklist";
import type { Tag, TagDetail, TagTaskEntry } from "#/schemas/tag";
import type { Task, TaskPageView } from "#/schemas/task";
import { applyOptimistically } from "./optimistic";

/*
 * A change reaching past the one thing it names: a task arriving on a tag's
 * page, a rename reaching titles, a checklist's name following a move.
 */

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
		stageId: "todo",
		...partial,
	};
}

function tag(tagId: string, name = tagId): Tag {
	return {
		tagId,
		name,
		color: "blue",
		special: null,
		description: "",
		startDate: null,
		deadline: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};
}

function summary(checklistId: string, title: string): ChecklistSummary {
	return {
		checklistId,
		title,
		description: "",
		startDate: "2026-01-01",
		deadline: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		progress: { total: 0, completed: 0, percent: 0, byStage: {} },
	};
}

/** A client holding these tasks in the search index, all in `chk_1`. */
function holding(tasks: Array<Task>): QueryClient {
	const client = new QueryClient();
	client.setQueryData<SearchIndex>(queryKeys.searchIndex, {
		checklists: [{ checklistId: "chk_1", title: "Work", description: "" }],
		trackers: [],
		tasks: tasks.map((each) => ({
			...each,
			checklistId: "chk_1",
			checklistTitle: "Work",
			caption: "",
		})),
	});
	return client;
}

const indexed = (client: QueryClient, taskId: string) =>
	client
		.getQueryData<SearchIndex>(queryKeys.searchIndex)
		?.tasks.find((each) => each.taskId === taskId);

describe("spreading a change", () => {
	it("draws a task on a tag's page the moment it gains the tag", () => {
		const client = holding([task({ taskId: "tsk_1" })]);
		client.setQueryData<TagDetail>(queryKeys.tag("today"), {
			...tag("tag_today", "today"),
			progress: { total: 0, completed: 0, percent: 0, inProgress: 0 },
			trackers: [],
		});
		client.setQueryData<Page<TagTaskEntry>>(
			queryKeys.tagOpenPage("today", VIEW),
			{ items: [], total: 0, page: 1 },
		);

		applyOptimistically(client, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { tagIds: ["tag_today"] },
		});

		const page = client.getQueryData<Page<TagTaskEntry>>(
			queryKeys.tagOpenPage("today", VIEW),
		);
		expect(page?.items.map((entry) => entry.task.taskId)).toEqual(["tsk_1"]);
		// Named under its title at once; see `checklistTitleOf`.
		expect(page?.items[0].checklistTitle).toBe("Work");
		expect(
			client.getQueryData<TagDetail>(queryKeys.tag("today"))?.progress.total,
		).toBe(1);
	});

	it("puts a moved task at the top of its new list, named there", () => {
		const client = holding([task({ taskId: "tsk_1" })]);
		client.setQueryData<Array<ChecklistSummary>>(queryKeys.checklists, [
			summary("chk_1", "Work"),
			summary("chk_2", "Home"),
		]);

		applyOptimistically(client, {
			kind: "task.move",
			taskId: "tsk_1",
			checklistId: "chk_2",
		});

		const moved = indexed(client, "tsk_1");
		expect(moved?.checklistTitle).toBe("Home");
		expect(moved !== undefined && moved.addedAt > "2026-01-01").toBe(true);
	});

	it("renames a tag where titles write it", () => {
		const client = holding([
			task({ taskId: "tsk_1", title: "Buy milk #shop", tagIds: ["tag_1"] }),
		]);
		client.setQueryData<Array<Tag>>(queryKeys.tags, [tag("tag_1", "shop")]);

		applyOptimistically(client, {
			kind: "tag.update",
			tagId: "tag_1",
			patch: { name: "groceries" },
		});

		expect(indexed(client, "tsk_1")?.title).toBe("Buy milk #groceries");
	});

	it("takes a deleted tag and a removed type off their tasks", () => {
		const client = holding([
			task({ taskId: "tsk_1", tagIds: ["tag_1"], typeId: "typ_1" }),
		]);
		client.setQueryData<Array<Tag>>(queryKeys.tags, [tag("tag_1")]);

		applyOptimistically(client, { kind: "tag.delete", tagId: "tag_1" });
		applyOptimistically(client, { kind: "taskTypes.set", types: [] });

		expect(indexed(client, "tsk_1")?.tagIds).toEqual([]);
		expect(indexed(client, "tsk_1")?.typeId).toBeNull();
	});
});
