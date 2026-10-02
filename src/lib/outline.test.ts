import { describe, expect, it } from "bun:test";
import { parseChecklistTitle, parseOutline } from "./outline";

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

		expect(first).toEqual({
			title: "Empty",
			urgent: false,
			important: false,
			description: "",
			tasks: [],
		});
		expect(second.description).toBe("One\nTwo");
	});

	it("keeps a description to the length a checklist allows", () => {
		const [checklist] = parseOutline(
			`# Long\n## ${"x".repeat(600)}`,
		).checklists;

		expect(checklist.description).toHaveLength(500);
	});
});

describe("parseChecklistTitle", () => {
	const stageNames = (text: string) =>
		parseChecklistTitle(text).stages?.map((stage) => stage.name);

	it("reads a closing priority off the title", () => {
		expect(parseChecklistTitle("Python -ui")).toEqual({
			title: "Python",
			urgent: true,
			important: true,
		});
		expect(parseChecklistTitle("Python -u").urgent).toBe(true);
		expect(parseChecklistTitle("Python -i").important).toBe(true);
		expect(parseChecklistTitle("sign-in").title).toBe("sign-in");
	});

	it("reads stages in brackets, before or after the priority", () => {
		const parsed = parseChecklistTitle(
			'Python ["To do", "In progress", "Done"] -ui',
		);
		expect(parsed.title).toBe("Python");
		expect(parsed.urgent && parsed.important).toBe(true);
		expect(stageNames('Python ["To do", "In progress", "Done"] -ui')).toEqual([
			"To do",
			"In progress",
			"Done",
		]);
		expect(stageNames('Python -i ["Todo","Done"]')).toEqual(["Todo", "Done"]);
		expect(parseChecklistTitle('Python -i ["Todo","Done"]').important).toBe(
			true,
		);
	});

	it("leaves a list that would not make stages in the title", () => {
		expect(parseChecklistTitle('Python ["Only"]')).toEqual({
			title: 'Python ["Only"]',
			urgent: false,
			important: false,
		});
		expect(stageNames('Python ["Done", "done"]')).toBeUndefined();
	});

	it("never leaves a title empty", () => {
		expect(parseChecklistTitle('["To do", "Done"]').title).toBe(
			'["To do", "Done"]',
		);
	});
});

describe("parseOutline, on headings", () => {
	it("reads a heading's priority and stages", () => {
		const [checklist] = parseOutline(
			'# Python ["To do", "Doing", "Done"] -ui\ntask',
		).checklists;

		expect(checklist.title).toBe("Python");
		expect(checklist.urgent && checklist.important).toBe(true);
		expect(checklist.stages?.map((stage) => stage.name)).toEqual([
			"To do",
			"Doing",
			"Done",
		]);
	});
});

describe("parseOutline, on settings under a heading", () => {
	const outline = parseOutline(
		[
			"# Python -ui",
			"deadline: 2026-12-01",
			'stages: ["To do", "Worked out", "In review", "Done"]',
			"## Advanced language features, async, typing",
			"python data model and dunder methods",
			"python iterators, generators and yield from -i",
			"",
			"# TypeScript & Node.js -ui",
			"Deadline: 2026-12-01 18:30",
			'stages: ["To do", "Worked out", "In review", "Done"]',
			"## Language depth, Node runtime",
			"javascript event loop: microtasks vs macrotasks -ui",
		].join("\n"),
	);
	const [python, typescript] = outline.checklists;

	it("reads the deadline, the stages and the priority", () => {
		expect(python.title).toBe("Python");
		expect(python.urgent && python.important).toBe(true);
		expect(python.deadline).toBe("2026-12-01");
		expect(python.deadlineTime).toBeUndefined();
		expect(python.stages?.map((stage) => stage.name)).toEqual([
			"To do",
			"Worked out",
			"In review",
			"Done",
		]);
		expect(python.description).toBe(
			"Advanced language features, async, typing",
		);
		expect(typescript.deadlineTime).toBe("18:30");
	});

	it("keeps the settings out of the tasks", () => {
		expect(python.tasks.map((task) => task.title)).toEqual([
			"python data model and dunder methods",
			"python iterators, generators and yield from",
		]);
		expect(typescript.tasks).toHaveLength(1);
	});

	it("keeps a setting it cannot read, or one after a task, as a task", () => {
		const [checklist] = parseOutline(
			'# Odd\ndeadline: someday\ntask\nstages: ["A", "B"]',
		).checklists;

		expect(checklist.deadline).toBeUndefined();
		expect(checklist.stages).toBeUndefined();
		expect(checklist.tasks.map((task) => task.title)).toEqual([
			"deadline: someday",
			"task",
			'stages: ["A", "B"]',
		]);
	});
});
