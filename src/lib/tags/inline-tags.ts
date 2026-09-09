/**
 * Tags written inline in a task title, as `#shopping`.
 *
 * Typing is the fastest way to tag something, so the tag goes in the same
 * keystrokes as the task: "bring coffee from market #shopping".
 *
 * The tag stays *in* the title, exactly where it was typed, and is highlighted
 * there rather than lifted out and shown somewhere else. "Hello #me hi" reads
 * back as "Hello #me hi". That keeps the sentence the user wrote intact, makes
 * editing a tag the same act as editing the text around it, and means there is
 * nothing to round-trip: the title *is* what was typed. The ids on the task are
 * derived from it.
 *
 * Pure. Knows nothing about React, the queue or the database.
 */

/**
 * A `#` only starts a tag at the beginning of a word, so "C# programming" and a
 * pasted URL fragment stay as text. A tag name runs to the first space.
 */
const INLINE_TAG = /(^|\s)#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;

/** Matches the tag being typed, at the very end of the text before the caret. */
const TRAILING_TAG = /(^|\s)#([\p{L}\p{N}_-]*)$/u;

/** Mirrors `tagNameSchema`, so a parsed name is always one the schema accepts. */
const MAX_TAG_NAME = 40;

export type ParsedTitle = {
	/** The text as typed, tags and all. */
	title: string;
	/** Names in the order written, without duplicates. */
	tagNames: Array<string>;
};

/**
 * One run of a title: either plain text or a tag written in it.
 *
 * `at` is where the run starts in the title. Two runs can never start at the
 * same offset, so it is the key React needs — and unlike an array index it
 * still names the same run when the text before it is edited.
 */
export type TitleSegment = { at: number } & (
	| { kind: "text"; text: string }
	| { kind: "tag"; name: string }
);

/** Tag names are matched case-insensitively; the first spelling seen wins. */
export function sameTagName(a: string, b: string): boolean {
	return a.toLowerCase() === b.toLowerCase();
}

/**
 * Read the tags out of a line without taking them out of it.
 *
 * A line with no tags comes back unchanged, so this is safe to run over every
 * title whether or not the user is using tags at all.
 */
export function parseInlineTags(text: string): ParsedTitle {
	const tagNames: Array<string> = [];

	for (const match of text.matchAll(INLINE_TAG)) {
		const name = match[2].slice(0, MAX_TAG_NAME);
		if (!tagNames.some((seen) => sameTagName(seen, name))) tagNames.push(name);
	}

	return { title: text.trim(), tagNames };
}

/**
 * Break a title into the runs needed to draw it: plain text, and the tags
 * written in it.
 *
 * The whitespace before a tag belongs to the text run, so re-joining the
 * segments gives back the original title character for character.
 */
export function splitTitleTags(title: string): Array<TitleSegment> {
	const segments: Array<TitleSegment> = [];
	let cursor = 0;

	for (const match of title.matchAll(INLINE_TAG)) {
		const start = (match.index ?? 0) + match[1].length;

		if (start > cursor) {
			segments.push({
				kind: "text",
				at: cursor,
				text: title.slice(cursor, start),
			});
		}

		segments.push({ kind: "tag", at: start, name: match[2] });
		cursor = start + 1 + match[2].length;
	}

	if (cursor < title.length) {
		segments.push({ kind: "text", at: cursor, text: title.slice(cursor) });
	}

	return segments;
}

export type TagQuery = {
	/** What has been typed after the `#`, possibly empty. */
	query: string;
	/** Index of the `#`, so the whole token can be replaced on picking one. */
	start: number;
};

/**
 * The tag being typed at the caret, if any.
 *
 * Only the token the caret sits at the end of counts — suggestions appear while
 * a tag is being written and nowhere else.
 */
export function activeTagQuery(text: string, caret: number): TagQuery | null {
	const match = TRAILING_TAG.exec(text.slice(0, caret));
	if (!match) return null;

	const [whole, before, query] = match;
	return { query, start: caret - whole.length + before.length };
}

/** Replace the tag being typed with a chosen name, and say where the caret goes. */
export function applyTagSuggestion(
	text: string,
	active: TagQuery,
	name: string,
): { text: string; caret: number } {
	const token = `#${name} `;
	const caret = active.start + token.length;

	return {
		text:
			text.slice(0, active.start) +
			token +
			text.slice(active.start + 1 + active.query.length),
		caret,
	};
}
