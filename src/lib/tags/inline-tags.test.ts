import { describe, expect, it } from "bun:test";
import {
	activeTagQuery,
	activeTrackerQuery,
	applyTagSuggestion,
	applyTrackerSuggestion,
	isInlineTagName,
	parseInlineTags,
	renameInlineTag,
	splitTitleTags,
	unwrittenTags,
	withInlineTag,
	withoutInlineTag,
} from "./inline-tags";

describe("parseInlineTags", () => {
	it("reads the tags without taking them out of the sentence", () => {
		expect(parseInlineTags("Hello #me hi")).toEqual({
			title: "Hello #me hi",
			tagNames: ["me"],
			trackerName: null,
		});
	});

	it("finds several tags anywhere in the line", () => {
		expect(
			parseInlineTags("bring coffee from market #shopping and pour it #chore"),
		).toEqual({
			title: "bring coffee from market #shopping and pour it #chore",
			tagNames: ["shopping", "chore"],
			trackerName: null,
		});
	});

	it("leaves a line with no tags exactly as it was", () => {
		expect(parseInlineTags("just a task")).toEqual({
			title: "just a task",
			tagNames: [],
			trackerName: null,
		});
	});

	it("ignores a hash that is not starting a word", () => {
		// Otherwise "C# programming" would look tagged.
		expect(parseInlineTags("learn C# properly")).toEqual({
			title: "learn C# properly",
			tagNames: [],
			trackerName: null,
		});
		expect(parseInlineTags("read docs#section").tagNames).toEqual([]);
	});

	it("keeps the first spelling and drops repeats", () => {
		expect(parseInlineTags("a #Work b #work c #WORK").tagNames).toEqual([
			"Work",
		]);
	});

	it("ignores a bare hash", () => {
		expect(parseInlineTags("nothing to see # here").tagNames).toEqual([]);
	});
});

describe("splitTitleTags", () => {
	it("picks the tags out for drawing, in place", () => {
		// The space before a tag belongs to the text run, which is what makes
		// re-joining the segments give back the title character for character.
		expect(splitTitleTags("Hello #me hi")).toEqual([
			{ kind: "text", at: 0, text: "Hello " },
			{ kind: "tag", at: 6, name: "me" },
			{ kind: "text", at: 9, text: " hi" },
		]);
	});

	it("gives every run a start offset of its own, for React to key on", () => {
		const offsets = splitTitleTags("a #one b #two c").map(
			(segment) => segment.at,
		);

		expect(new Set(offsets).size).toBe(offsets.length);
	});

	it("re-joins to exactly the original title", () => {
		for (const title of [
			"Hello #me hi",
			"#chore",
			"plain text only",
			"buy milk #shopping",
			"learn C# properly",
			"a #one b #two c",
		]) {
			const joined = splitTitleTags(title)
				.map((s) => (s.kind === "text" ? s.text : `#${s.name}`))
				.join("");
			expect(joined).toBe(title);
		}
	});

	it("handles a title that is only a tag", () => {
		expect(splitTitleTags("#chore")).toEqual([
			{ kind: "tag", at: 0, name: "chore" },
		]);
	});
});

describe("activeTagQuery", () => {
	const at = (text: string) => activeTagQuery(text, text.length);

	it("finds the tag being typed", () => {
		expect(at("buy milk #sho")).toEqual({ query: "sho", start: 9 });
	});

	it("offers everything straight after the hash", () => {
		expect(at("buy milk #")).toEqual({ query: "", start: 9 });
	});

	it("stops once the tag is finished", () => {
		expect(at("buy milk #shopping ")).toBeNull();
	});

	it("says nothing when no tag is being typed", () => {
		expect(at("buy milk")).toBeNull();
		expect(at("")).toBeNull();
	});

	it("only looks at the caret, not the whole line", () => {
		const text = "buy #milk and #eggs";
		expect(activeTagQuery(text, 8)).toEqual({ query: "mil", start: 4 });
	});
});

describe("applyTagSuggestion", () => {
	it("completes the tag and leaves the caret after it", () => {
		const text = "buy milk #sho";
		const active = activeTagQuery(text, text.length);
		if (!active) throw new Error("expected a query");

		expect(applyTagSuggestion(text, active, "shopping")).toEqual({
			text: "buy milk #shopping ",
			caret: 19,
		});
	});

	it("keeps whatever follows the caret", () => {
		const text = "buy #mi later";
		const active = activeTagQuery(text, 7);
		if (!active) throw new Error("expected a query");

		expect(applyTagSuggestion(text, active, "milk").text).toBe(
			"buy #milk  later",
		);
	});
});

describe("tracker lines", () => {
	it("reads a whole line as one tracker, spaces and all", () => {
		expect(parseInlineTags("&Dune Part Two")).toEqual({
			title: "&Dune Part Two",
			tagNames: [],
			trackerName: "Dune Part Two",
		});
	});

	it("only counts an ampersand at the start", () => {
		expect(parseInlineTags("Tom & Jerry").trackerName).toBeNull();
	});

	it("takes no tags off a tracker line: its title is the tracker's", () => {
		expect(parseInlineTags("&Dune #reading").tagNames).toEqual([]);
	});

	it("draws the whole line as one tracker run", () => {
		expect(splitTitleTags("&Dune Part Two")).toEqual([
			{ kind: "tracker", at: 0, name: "Dune Part Two" },
		]);
	});

	it("suggests from the moment the ampersand is typed", () => {
		expect(activeTrackerQuery("&", 1)).toEqual({ query: "", start: 0 });
		expect(activeTrackerQuery("&Du", 3)).toEqual({ query: "Du", start: 0 });
	});

	it("suggests on any line of a pasted list, not just the first", () => {
		const text = "buy milk\n&Du";
		expect(activeTrackerQuery(text, text.length)).toEqual({
			query: "Du",
			start: 9,
		});
	});

	it("suggests nothing on a line that does not start with one", () => {
		expect(activeTrackerQuery("buy milk", 8)).toBeNull();
		expect(activeTrackerQuery("Tom & Je", 8)).toBeNull();
	});

	it("replaces the line it is on and leaves the others alone", () => {
		const text = "buy milk\n&Du\nwalk";
		const active = activeTrackerQuery(text, 12);
		if (active === null) throw new Error("expected a query");

		expect(applyTrackerSuggestion(text, active, "Dune")).toEqual({
			text: "buy milk\n&Dune\nwalk",
			caret: 14,
		});
	});
});

describe("isInlineTagName", () => {
	it("accepts a name that reads back the same", () => {
		expect(isInlineTagName("shopping")).toBe(true);
		expect(isInlineTagName("q3-launch")).toBe(true);
	});

	it("refuses one that would be cut short or lost", () => {
		// Written inline, these read back as "Q3" and as nothing at all.
		expect(isInlineTagName("Q3 launch")).toBe(false);
		expect(isInlineTagName("-draft")).toBe(false);
	});
});

describe("withInlineTag", () => {
	it("writes the tag at the end, the way the bolt adds it", () => {
		expect(withInlineTag("call mum", "today")).toBe("call mum #today");
	});

	it("leaves a title that already writes it, anywhere and in any case", () => {
		expect(withInlineTag("call #Today mum", "today")).toBe("call #Today mum");
	});

	it("does not mistake a longer tag for it", () => {
		expect(withInlineTag("plan #todays-list", "today")).toBe(
			"plan #todays-list #today",
		);
	});
});

describe("withoutInlineTag", () => {
	it("takes it off the end", () => {
		expect(withoutInlineTag("call mum #today", "today")).toBe("call mum");
	});

	it("takes it out of the middle and closes the gap", () => {
		expect(withoutInlineTag("call #today mum", "today")).toBe("call mum");
	});

	it("takes it off the start", () => {
		expect(withoutInlineTag("#today call mum", "today")).toBe("call mum");
	});

	it("takes every mention, whatever the case, and nothing else", () => {
		expect(withoutInlineTag("#Today call #home #TODAY", "today")).toBe(
			"call #home",
		);
		expect(withoutInlineTag("plan #todays-list", "today")).toBe(
			"plan #todays-list",
		);
	});

	it("keeps the word when the tag was the whole title", () => {
		expect(withoutInlineTag("#today", "today")).toBe("today");
	});
});

describe("renameInlineTag", () => {
	it("rewrites each mention in place", () => {
		expect(renameInlineTag("call #today mum #Today", "today", "doing")).toBe(
			"call #doing mum #doing",
		);
	});

	it("leaves other tags and look-alikes alone", () => {
		expect(renameInlineTag("C# #todays #home", "today", "doing")).toBe(
			"C# #todays #home",
		);
	});
});

describe("unwrittenTags", () => {
	const tags = [
		{ tagId: "tag_shop", name: "shopping" },
		{ tagId: "tag_home", name: "Home" },
	];

	it("returns the tags the title does not write, in the task's order", () => {
		expect(
			unwrittenTags("buy milk #shopping", ["tag_home", "tag_shop"], tags),
		).toEqual([{ tagId: "tag_home", name: "Home" }]);
	});

	it("counts a written tag whatever its case", () => {
		expect(unwrittenTags("tidy #home", ["tag_home"], tags)).toEqual([]);
	});

	it("skips an id with no tag behind it", () => {
		expect(unwrittenTags("anything", ["tag_gone"], tags)).toEqual([]);
	});
});
