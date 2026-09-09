import { describe, expect, it } from "bun:test";
import type { PendingChange } from "#/schemas/pending";
import { MAX_IN_FLIGHT, planRuns } from "./plan";

const now = "2026-09-09T00:00:00.000Z";

const newChecklist = (checklistId: string): PendingChange => ({
	kind: "checklist.create",
	checklistId,
	title: "List",
	description: "",
	startDate: "2026-09-01",
	deadline: null,
});

const newTask = (checklistId: string, taskId: string): PendingChange => ({
	kind: "task.create",
	checklistId,
	taskId,
	title: "Task",
	addedAt: now,
	tagIds: [],
	urgent: false,
	important: false,
});

const addRef = (
	checklistId: string,
	taskId: string,
	sortOrder = 10,
): PendingChange => ({
	kind: "ref.add",
	list: "today",
	itemId: `itm_${taskId}`,
	checklistId,
	taskId,
	sortOrder,
});

const newEntry = (trackerId: string, entryId: string): PendingChange => ({
	kind: "entry.create",
	trackerId,
	entryId,
	value: 10,
	recordedAt: "2026-09-01",
	note: "",
});

/** Runs, described by how many changes each holds. */
const shape = (changes: Array<PendingChange>) =>
	planRuns(changes).map((run) => run.length);

describe("planRuns", () => {
	it("keeps a change behind one it depends on", () => {
		// A task cannot be written into a checklist that does not exist yet.
		expect(shape([newChecklist("chk_a"), newTask("chk_a", "tsk_1")])).toEqual([
			1, 1,
		]);
	});

	it("sends tasks in the same checklist out together", () => {
		expect(
			shape([
				newTask("chk_a", "tsk_1"),
				newTask("chk_a", "tsk_2"),
				newTask("chk_a", "tsk_3"),
			]),
		).toEqual([3]);
	});

	it("sends a pasted list out behind the checklist, not one change at a time", () => {
		const changes = [newChecklist("chk_a")];
		for (const taskId of ["tsk_1", "tsk_2"]) {
			changes.push(newTask("chk_a", taskId), addRef("chk_a", taskId));
		}

		// A reference is keyed by what it points at, not by the task document, so
		// it does not have to wait for the task it names.
		expect(shape(changes)).toEqual([1, 4]);
	});

	it("never puts more than MAX_IN_FLIGHT in one run", () => {
		const changes = [newChecklist("chk_a")];
		for (const taskId of ["tsk_1", "tsk_2", "tsk_3", "tsk_4"]) {
			changes.push(newTask("chk_a", taskId), addRef("chk_a", taskId));
		}

		const runs = planRuns(changes);
		expect(runs.every((run) => run.length <= MAX_IN_FLIGHT)).toBe(true);
		expect(shape(changes)).toEqual([1, 5, 3]);
	});

	it("serialises two edits to the same task", () => {
		expect(
			shape([
				newTask("chk_a", "tsk_1"),
				{
					kind: "task.update",
					checklistId: "chk_a",
					taskId: "tsk_1",
					patch: { completed: true },
				},
			]),
		).toEqual([1, 1]);
	});

	it("holds a checklist deletion apart from writes into it", () => {
		expect(
			shape([
				newTask("chk_a", "tsk_1"),
				{ kind: "checklist.delete", checklistId: "chk_a" },
			]),
		).toEqual([1, 1]);
	});

	it("serialises readings on one tracker but not across trackers", () => {
		// Each reading recomputes the tracker's total from the whole history.
		expect(
			shape([newEntry("trk_a", "ent_1"), newEntry("trk_a", "ent_2")]),
		).toEqual([1, 1]);
		expect(
			shape([newEntry("trk_a", "ent_1"), newEntry("trk_b", "ent_2")]),
		).toEqual([2]);
	});

	it("gives a tag deletion a run of its own", () => {
		// It strips the id from every task carrying it, in any checklist.
		const runs = planRuns([
			newTask("chk_a", "tsk_1"),
			{ kind: "tag.delete", tagId: "tag_1" },
			newTask("chk_a", "tsk_2"),
		]);

		expect(runs.map((run) => run.length)).toEqual([1, 1, 1]);
		expect(runs[1][0].kind).toBe("tag.delete");
	});

	it("claims the list when a reference has to be put at the end", () => {
		// A sort order of zero means "work out the end", which reads the list.
		expect(
			shape([addRef("chk_a", "tsk_1", 0), addRef("chk_a", "tsk_2", 0)]),
		).toEqual([1, 1]);
		expect(
			shape([addRef("chk_a", "tsk_1", 10), addRef("chk_a", "tsk_2", 20)]),
		).toEqual([2]);
	});

	it("caps how many go out at once", () => {
		const changes = Array.from({ length: MAX_IN_FLIGHT + 3 }, (_, index) =>
			newTask("chk_a", `tsk_${index}`),
		);

		expect(shape(changes)).toEqual([MAX_IN_FLIGHT, 3]);
	});

	it("replays every change exactly once, in order", () => {
		const changes = [
			newChecklist("chk_a"),
			newTask("chk_a", "tsk_1"),
			addRef("chk_a", "tsk_1"),
			{ kind: "tag.delete", tagId: "tag_1" } satisfies PendingChange,
			newTask("chk_a", "tsk_2"),
			{ kind: "ref.move", list: "today", itemId: "itm_1", direction: "up" },
		] satisfies Array<PendingChange>;

		expect(planRuns(changes).flat()).toEqual(changes);
	});

	it("has nothing to do with an empty batch", () => {
		expect(planRuns([])).toEqual([]);
	});
});
