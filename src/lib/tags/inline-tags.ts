/**
 * Marks written inline in a task title: `#shopping` for a tag, `&Dune` for a
 * tracker.
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
	/** The text as typed, marks and all. */
	title: string;
	/** Names in the order written, without duplicates. */
	tagNames: Array<string>;
	/**
	 * The tracker this line names, if it is a tracker line at all.
	 *
	 * A name rather than an id, for the same reason tags are names here: the
	 * title is what was typed, and the ids are derived from it at the moment it
	 * is submitted. Nothing hidden has to be carried alongside the text.
	 */
	trackerName: string | null;
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
	| { kind: "tracker"; name: string }
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
	const trimmed = text.trim();

	// A tracker line is only a tracker: its title comes from the tracker itself,
	// so there is nothing else on the line for a tag to attach to.
	const tracker = INLINE_TRACKER.exec(trimmed);
	if (tracker) {
		return {
			title: trimmed,
			tagNames: [],
			trackerName: tracker[1].trim(),
		};
	}

	const tagNames: Array<string> = [];

	for (const match of text.matchAll(INLINE_TAG)) {
		const name = match[2].slice(0, MAX_TAG_NAME);
		if (!tagNames.some((seen) => sameTagName(seen, name))) tagNames.push(name);
	}

	return { title: trimmed, tagNames, trackerName: null };
}

/**
 * Whether a tag's name can be written inline and read back unchanged.
 *
 * Not every name can: one given a space on the Tags screen — "Q3 launch" —
 * would be read back as "Q3". A field that writes tags as `#name` has to know
 * which ones it cannot write, or saving it would quietly rename them.
 */
export function isInlineTagName(name: string): boolean {
	return parseInlineTags(`#${name}`).tagNames[0] === name;
}

/**
 * A title with `#name` written at its end, the way the row's bolt adds a tag —
 * or the title as it is, if it already writes that tag somewhere.
 */
export function withInlineTag(title: string, name: string): string {
	const isWritten = parseInlineTags(title).tagNames.some((written) =>
		sameTagName(written, name),
	);

	return isWritten ? title : `${title.trimEnd()} #${name}`;
}

/**
 * A title with every `#name` of one tag taken out, wherever it was written —
 * the end, the start or the middle of the sentence — and the gap it leaves
 * closed up.
 *
 * A title that was nothing but the tag keeps the word without its `#`: a task
 * cannot have an empty title, and the word is what the user wrote.
 */
export function withoutInlineTag(title: string, name: string): string {
	const without = title
		.replace(INLINE_TAG, (whole, before: string, written: string) =>
			sameTagName(written, name) ? before : whole,
		)
		.replace(/[ \t]{2,}/g, " ")
		.trim();

	return without === "" ? name : without;
}

/** A title with each `#from` rewritten as `#to`, for a tag that was renamed. */
export function renameInlineTag(
	title: string,
	from: string,
	to: string,
): string {
	return title.replace(INLINE_TAG, (whole, before: string, written: string) =>
		sameTagName(written, from) ? `${before}#${to}` : whole,
	);
}

/**
 * The tags a task carries that its title does not write — the ones it has from
 * its checklist — so they can be drawn beside the title instead of in it.
 */
export function unwrittenTags<T extends { tagId: string; name: string }>(
	title: string,
	tagIds: ReadonlyArray<string>,
	tags: ReadonlyArray<T>,
): Array<T> {
	const written = parseInlineTags(title).tagNames;

	return tagIds.flatMap((tagId) => {
		const tag = tags.find((candidate) => candidate.tagId === tagId);
		return tag && !written.some((name) => sameTagName(name, tag.name))
			? [tag]
			: [];
	});
}

/**
 * Break a title into the runs needed to draw it: plain text, and the tags
 * written in it.
 *
 * The whitespace before a tag belongs to the text run, so re-joining the
 * segments gives back the original title character for character.
 */
export function splitTitleTags(title: string): Array<TitleSegment> {
	const tracker = INLINE_TRACKER.exec(title);
	if (tracker) return [{ kind: "tracker", at: 0, name: tracker[1] }];

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

/* -------------------------------------------------------------------------- */
/* Trackers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A line that stands for a tracker, written `&Dune`.
 *
 * `&` only counts at the start of a line, and it then claims the whole line:
 * unlike a tag, a tracker's title is its real title and titles have spaces in
 * them. That also makes the rule easy to hold — a line either is a tracker or
 * is not, and there is no half-way case to explain.
 */
const INLINE_TRACKER = /^&(.*)$/;

/** The line the caret sits on, and where that line starts in the whole text. */
function lineAtCaret(
	text: string,
	caret: number,
): { line: string; start: number } {
	const start = text.lastIndexOf("\n", Math.max(caret - 1, 0)) + 1;
	const end = text.indexOf("\n", start);

	return { line: text.slice(start, end === -1 ? undefined : end), start };
}

/** Tracker titles are matched the way tag names are: ignoring case. */
export function sameTrackerName(a: string, b: string): boolean {
	return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export type TrackerQuery = {
	/** What has been typed after the `&`, possibly empty. */
	query: string;
	/** Index of the `&`, so the whole line can be replaced on picking one. */
	start: number;
};

/**
 * The tracker being named on the line the caret is on, if any.
 *
 * Suggestions appear from the moment `&` is typed and stay while the title is
 * being written, because the title may not be finished and still match.
 */
export function activeTrackerQuery(
	text: string,
	caret: number,
): TrackerQuery | null {
	const { line, start } = lineAtCaret(text, caret);
	if (!line.startsWith("&")) return null;

	// Only while the caret is still on that line, not once it has moved past it.
	if (caret < start + 1 || caret > start + line.length) return null;

	return { query: line.slice(1, caret - start), start };
}

/** Replace the line being typed with a chosen tracker, and place the caret. */
export function applyTrackerSuggestion(
	text: string,
	active: TrackerQuery,
	title: string,
): { text: string; caret: number } {
	const { line } = lineAtCaret(text, active.start + 1);
	const token = `&${title}`;

	return {
		text:
			text.slice(0, active.start) +
			token +
			text.slice(active.start + line.length),
		caret: active.start + token.length,
	};
}
