import { describe, expect, it } from "bun:test";
import { restaged, type Stage } from "./checklist";

const TODO: Stage = { stageId: "todo", name: "To do" };
const REVIEW: Stage = { stageId: "review", name: "Review" };
const DONE: Stage = { stageId: "done", name: "Done" };
const SHIPPED: Stage = { stageId: "shipped", name: "Shipped" };

describe("restaged", () => {
	it("sends a task at a stage taken away back to the one before it", () => {
		expect(
			restaged(
				{ stageId: "review", completed: false },
				[TODO, REVIEW, DONE],
				[TODO, DONE],
			),
		).toEqual({ stageId: "todo", completed: false });
	});

	it("reopens what was done when a stage is added after Done", () => {
		expect(
			restaged(
				{ stageId: "done", completed: true },
				[TODO, DONE],
				[TODO, DONE, SHIPPED],
			),
		).toEqual({ stageId: "done", completed: false });
	});

	it("leaves a task left open at the old last stage there on a retry", () => {
		// The first try wrote the task; the checklist itself was not saved.
		expect(
			restaged(
				{ stageId: "done", completed: false },
				[TODO, DONE],
				[TODO, DONE, SHIPPED],
			),
		).toBeNull();
	});

	it("leaves a task following a tracker to the tracker", () => {
		expect(
			restaged(
				{ stageId: "review", completed: false, trackerId: "trk_1" },
				[TODO, REVIEW, DONE],
				[TODO, DONE],
			),
		).toBeNull();
	});
});
