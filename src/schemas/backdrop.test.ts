import { describe, expect, it } from "bun:test";
import * as v from "valibot";
import {
	backdropOf,
	pageLabel,
	pageOf,
	setBackdropInputSchema,
} from "./backdrop";

describe("pageOf", () => {
	it("gives a list page its section's key", () => {
		expect(pageOf("/checklists")).toEqual({
			key: "checklists",
			section: "checklists",
		});
		expect(pageOf("/settings")).toEqual({
			key: "settings",
			section: "settings",
		});
	});

	it("gives each item's page a key of its own", () => {
		expect(pageOf("/checklists/chk_abc123")).toEqual({
			key: "checklists/chk_abc123",
			section: "checklists",
		});
		expect(pageOf("/trackers/trk_x")).toEqual({
			key: "trackers/trk_x",
			section: "trackers",
		});
	});

	it("treats the Today tag as Today, not as a tag", () => {
		expect(pageOf("/tags/today")).toEqual({ key: "today", section: "today" });
	});

	it("dresses anywhere else as Today", () => {
		expect(pageOf("/")).toEqual({ key: "today", section: "today" });
		expect(pageOf("/login")).toEqual({ key: "today", section: "today" });
	});
});

describe("backdropOf", () => {
	const checklist = pageOf("/checklists/chk_1");

	it("uses what was picked for the page itself", () => {
		expect(
			backdropOf(
				{
					checklists: { design: "orbit", palette: "ocean" },
					"checklists/chk_1": { design: null, palette: "mint" },
				},
				checklist,
			),
		).toEqual({ design: null, palette: "mint" });
	});

	it("falls back to its list page's pick", () => {
		expect(
			backdropOf(
				{ checklists: { design: "orbit", palette: "ocean" } },
				checklist,
			),
		).toEqual({ design: "orbit", palette: "ocean" });
	});

	it("is drawn as its section starts when nothing was picked", () => {
		expect(backdropOf({}, checklist)).toEqual({
			design: "pebbles",
			palette: null,
		});
	});
});

describe("pageLabel", () => {
	it("names a list page, and calls an item's page by what it is", () => {
		expect(pageLabel(pageOf("/trackers"))).toBe("Trackers");
		expect(pageLabel(pageOf("/trackers/trk_1"))).toBe("this tracker");
		expect(pageLabel(pageOf("/tags/untagged"))).toBe("Untagged");
	});
});

describe("setBackdropInputSchema", () => {
	const input = (page: string) => ({ page, design: null, palette: null });

	it("takes a list page or one item's page", () => {
		expect(v.is(setBackdropInputSchema, input("tags"))).toBe(true);
		expect(v.is(setBackdropInputSchema, input("tags/tag_ab-1"))).toBe(true);
	});

	it("refuses anything that would reach elsewhere in the document", () => {
		expect(v.is(setBackdropInputSchema, input("nowhere"))).toBe(false);
		expect(v.is(setBackdropInputSchema, input("tags/a.b"))).toBe(false);
		expect(v.is(setBackdropInputSchema, input("tags/$set"))).toBe(false);
		expect(v.is(setBackdropInputSchema, input("tags/a/b"))).toBe(false);
	});
});
