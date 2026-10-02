import { describe, expect, it } from "bun:test";
import { parseOutline } from "./outline";

describe("parseOutline", () => {
	it("makes a checklist of each # heading, its ## line the description", () => {
		const outline = parseOutline(
			[
				"# Python",
				"## Advanced language features, async, typing",
				"python asyncio gather, taskgroups and cancellation -i",
				"fastapi middleware, error handling and openapi docs",
				"",
				"# TypeScript & Node.js",
				"## Language depth, Node runtime",
				"javascript event loop: microtasks vs macrotasks -ui",
			].join("\n"),
		);

		expect(outline.skipped).toBe(0);
		expect(
			outline.checklists.map(({ title, description, tasks }) => ({
				title,
				description,
				tasks: tasks.map((task) => [task.title, task.urgent, task.important]),
			})),
		).toEqual([
			{
				title: "Python",
				description: "Advanced language features, async, typing",
				tasks: [
					["python asyncio gather, taskgroups and cancellation", false, true],
					["fastapi middleware, error handling and openapi docs", false, false],
				],
			},
			{
				title: "TypeScript & Node.js",
				description: "Language depth, Node runtime",
				tasks: [
					["javascript event loop: microtasks vs macrotasks", true, true],
				],
			},
		]);
	});

	it("reads tags on a line, and does not take a #tag for a heading", () => {
		const [checklist] = parseOutline(
			"# Home\n#chores first\nbuy milk #shopping",
		).checklists;

		expect(checklist.tasks.map((task) => task.tagNames)).toEqual([
			["chores"],
			["shopping"],
		]);
	});

	it("takes list markers off the front of a line", () => {
		const [checklist] = parseOutline(
			"# Trip\n- passport\n* tickets\n1. visa\n- [ ] charger\n- [x] bag",
		).checklists;

		expect(checklist.tasks.map((task) => task.title)).toEqual([
			"passport",
			"tickets",
			"visa",
			"charger",
			"bag",
		]);
	});

	it("counts the lines above the first heading rather than guessing", () => {
		const outline = parseOutline("stray line\nanother\n# Real\ntask");

		expect(outline.skipped).toBe(2);
		expect(outline.checklists).toHaveLength(1);
	});

	it("keeps a heading with nothing under it, and joins deeper headings", () => {
		const [first, second] = parseOutline(
			"# Empty\n# Notes\n## One\n### Two\ntask",
		).checklists;

		expect(first).toEqual({ title: "Empty", description: "", tasks: [] });
		expect(second.description).toBe("One\nTwo");
	});

	it("keeps a description to the length a checklist allows", () => {
		const [checklist] = parseOutline(
			`# Long\n## ${"x".repeat(600)}`,
		).checklists;

		expect(checklist.description).toHaveLength(500);
	});
});
