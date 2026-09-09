import { describe, expect, it } from "bun:test";
import {
	activeTagQuery,
	applyTagSuggestion,
	parseInlineTags,
	splitTitleTags,
} from "./inline-tags";

describe("parseInlineTags", () => {
	it("reads the tags without taking them out of the sentence", () => {
		expect(parseInlineTags("Hello #me hi")).toEqual({
			title: "Hello #me hi",
			tagNames: ["me"],
		});
	});

	it("finds several tags anywhere in the line", () => {
		expect(
			parseInlineTags("bring coffee from market #shopping and pour it #chore"),
		).toEqual({
			title: "bring coffee from market #shopping and pour it #chore",
			tagNames: ["shopping", "chore"],
		});
	});

	it("leaves a line with no tags exactly as it was", () => {
		expect(parseInlineTags("just a task")).toEqual({
			title: "just a task",
			tagNames: [],
		});
	});

	it("ignores a hash that is not starting a word", () => {
		// Otherwise "C# programming" would look tagged.
		expect(parseInlineTags("learn C# properly")).toEqual({
			title: "learn C# properly",
			tagNames: [],
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
			{ kind: "text", text: "Hello " },
			{ kind: "tag", name: "me" },
			{ kind: "text", text: " hi" },
		]);
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
		expect(splitTitleTags("#chore")).toEqual([{ kind: "tag", name: "chore" }]);
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
