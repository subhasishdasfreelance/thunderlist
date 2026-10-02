/**
 * Reading a pasted Markdown outline into checklists, for a group made from it
 * in one go:
 *
 *     # Python
 *     ## Async, typing, packaging
 *     python asyncio gather and cancellation -i
 *     fastapi middleware and error handling
 *
 * A `#` heading starts a checklist titled with it. A deeper heading under it —
 * `##` and on — is its description. Every other line is one of its tasks,
 * read the way a typed task is: `#tags` and a closing `-u`, `-i` or `-ui`
 * included; see `parseInlineTags`. A list marker in front of a line — `-`,
 * `*`, `1.`, a `[ ]` box — is taken off.
 *
 * Pure. Knows nothing about React, the queue or the database.
 */

import { type ParsedTitle, parseInlineTags } from "#/lib/tags/inline-tags";

/** Mirrors `descriptionSchema`, so a parsed description is always accepted. */
const MAX_DESCRIPTION = 500;

const HEADING = /^(#{1,6})\s+(.*)$/;

const LIST_MARKER = /^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;

export type OutlineChecklist = {
	title: string;
	description: string;
	tasks: Array<ParsedTitle>;
};

export type Outline = {
	checklists: Array<OutlineChecklist>;
	/** Lines above the first `#` heading, which belong to no checklist. */
	skipped: number;
};

export function parseOutline(text: string): Outline {
	const checklists: Array<OutlineChecklist> = [];
	const descriptions: Array<Array<string>> = [];
	let skipped = 0;

	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (line === "") continue;

		const heading = HEADING.exec(line);
		const current = checklists.at(-1);

		if (heading && heading[1].length === 1 && heading[2].trim() !== "") {
			checklists.push({ title: heading[2].trim(), description: "", tasks: [] });
			descriptions.push([]);
		} else if (current === undefined) {
			skipped += 1;
		} else if (heading) {
			const words = heading[2].trim();
			if (words !== "") descriptions[descriptions.length - 1].push(words);
		} else {
			const parsed = parseInlineTags(line.replace(LIST_MARKER, ""));
			if (parsed.title !== "") current.tasks.push(parsed);
		}
	}

	checklists.forEach((checklist, at) => {
		checklist.description = descriptions[at]
			.join("\n")
			.slice(0, MAX_DESCRIPTION)
			.trim();
	});

	return { checklists, skipped };
}
