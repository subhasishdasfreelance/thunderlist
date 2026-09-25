import { describe, expect, it } from "bun:test";
import { manualOrder, sectionsOf } from "./arrangement";

const idOf = (id: string) => id;

describe("manualOrder", () => {
	it("puts the placed ones first, as placed, then the rest as they came", () => {
		expect(manualOrder(["a", "b", "c", "d"], idOf, ["c", "a"])).toEqual([
			"c",
			"a",
			"b",
			"d",
		]);
	});

	it("ignores ids that name nothing", () => {
		expect(manualOrder(["a", "b"], idOf, ["gone", "b"])).toEqual(["b", "a"]);
	});
});

describe("sectionsOf", () => {
	const groups = [
		{ groupId: "g1", name: "Work", itemIds: ["b", "d"] },
		{ groupId: "g2", name: "Empty", itemIds: [] },
		{ groupId: "g3", name: "Home", itemIds: ["d", "c"] },
	];

	it("cuts the list into its groups, keeping its order, the ungrouped last", () => {
		const sections = sectionsOf(["a", "b", "c", "d"], idOf, groups);

		expect(
			sections.map((section) => [section.group?.name ?? null, section.items]),
		).toEqual([
			["Work", ["b", "d"]],
			["Home", ["c"]],
			[null, ["a"]],
		]);
	});

	it("draws no heading-only sections when nothing is grouped", () => {
		expect(sectionsOf(["a"], idOf, [])).toEqual([
			{ group: null, items: ["a"] },
		]);
	});
});
