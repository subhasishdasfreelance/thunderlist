import { describe, expect, it } from "bun:test";
import type { Task } from "#/schemas/task";
import { type Sources, searchResults } from "./search-results";

function task(taskId: string, number: number, title: string) {
	return {
		taskId,
		number,
		title,
		completed: false,
		completedAt: null,
		addedAt: "2026-01-01T00:00:00.000Z",
		tagIds: [],
		trackerId: null,
		urgent: false,
		important: false,
		checklistId: "chk_1",
		checklistTitle: "Work",
		caption: "",
	} as Task & { checklistId: string; checklistTitle: string; caption: string };
}

const sources: Sources = {
	index: {
		checklists: [
			{ checklistId: "chk_1", number: 42, title: "Work", description: "" },
		],
		trackers: [],
		entries: [
			{
				entryId: "ent_1",
				number: 42,
				trackerId: "trk_1",
				recordedAt: "2026-01-02",
				value: 30,
				note: "",
			},
		],
		tasks: [
			task("tsk_1", 42, "Write the brief"),
			task("tsk_2", 7, "Call about 42 Oak Street"),
		],
	},
	tags: [],
	plans: [],
	countdowns: [],
	groups: [],
};

describe("searchResults", () => {
	it("finds exactly the one thing a prefixed number names", () => {
		const found = searchResults("T-42", sources);
		expect(found.map((each) => each.key)).toEqual(["tsk-tsk_1"]);
		expect(found[0]?.number).toBe("T-42");
		expect(found[0]?.focus).toEqual({ task: "tsk_1" });
	});

	it("finds every kind's number for a bare one, then names that hold it", () => {
		const keys = searchResults("42", sources).map((each) => each.key);
		expect(keys).toContain("chk-chk_1");
		expect(keys).toContain("ent-ent_1");
		// The task numbered 42 before the one that only mentions it.
		expect(keys.indexOf("tsk-tsk_1")).toBeLessThan(keys.indexOf("tsk-tsk_2"));
	});

	it("finds a task by its notes or caption, after the titles that match", () => {
		const found = searchResults("oak", {
			...sources,
			index: {
				...sources.index,
				tasks: [
					{ ...task("tsk_3", 3, "Visit"), notes: "Meet at the oak tree" },
					{ ...task("tsk_4", 4, "Book"), caption: "Oakland trip" },
					...sources.index.tasks,
				],
			},
		});

		expect(found.map((each) => each.key)).toEqual([
			"tsk-tsk_2",
			"tsk-tsk_3",
			"tsk-tsk_4",
		]);
		expect(found[1]?.context).toBe("Work · in its notes");
		expect(found[2]?.context).toBe("Work · in its caption");
	});

	it("sends a reading to its tracker, to be ringed there", () => {
		const [entry] = searchResults("e42", sources);
		expect(entry?.to).toBe("/trackers/trk_1");
		expect(entry?.focus).toEqual({ entry: "ent_1" });
	});
});
