import { describe, expect, it } from "bun:test";
import { formatNumber, parseNumberQuery } from "./number";

describe("numbers", () => {
	it("writes a number with its kind's prefix", () => {
		expect(formatNumber("task", 42)).toBe("T-42");
		expect(formatNumber("tracker", 7)).toBe("TR-7");
		expect(formatNumber("countdown", 3)).toBe("CD-3");
	});

	it("reads a number however it is typed", () => {
		for (const typed of ["T-42", "t42", "t 42", " T-42 "]) {
			expect(parseNumberQuery(typed)).toEqual({ kind: "task", number: 42 });
		}
		expect(parseNumberQuery("tr-7")).toEqual({ kind: "tracker", number: 7 });
		expect(parseNumberQuery("CD3")).toEqual({ kind: "countdown", number: 3 });
	});

	it("reads a bare number as any kind's", () => {
		expect(parseNumberQuery("42")).toEqual({ kind: null, number: 42 });
		expect(parseNumberQuery("#42")).toEqual({ kind: null, number: 42 });
	});

	it("leaves words alone", () => {
		expect(parseNumberQuery("tea")).toBeNull();
		expect(parseNumberQuery("page 42")).toBeNull();
		expect(parseNumberQuery("x-42")).toBeNull();
	});
});
