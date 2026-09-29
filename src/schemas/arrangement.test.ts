import { describe, expect, it } from "bun:test";
import { manualOrder } from "./arrangement";

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
