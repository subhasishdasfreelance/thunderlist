/**
 * Reading a pasted Markdown outline into checklists, for a group made from it
 * in one go:
 *
 *     # Python -ui
 *     deadline: 2026-12-01
 *     stages: ["To do", "In review", "Done"]
 *     ## Async, typing, packaging
 *     python asyncio gather and cancellation -i
 *     fastapi middleware and error handling
 *
 * A `#` heading starts a checklist titled with it, read for its priority and
 * stages as a new checklist's title is; see `parseChecklistTitle`. Before its
 * first task, a `deadline:` line — a day, and a time if wanted — and a
 * `stages:` line set those; one that cannot be read is a task as typed, so
 * nothing written is lost. A deeper heading under it —
 * `##` and on — is its description. Every other line is one of its tasks,
 * read the way a typed task is: `#tags` and a closing `-u`, `-i` or `-ui`
 * included; see `parseInlineTags`. A list marker in front of a line — `-`,
 * `*`, `1.`, a `[ ]` box — is taken off.
 *
 * Pure. Knows nothing about React, the queue or the database.
 */

import * as v from "valibot";
import { createId, ID_PREFIX } from "#/lib/ids";
import {
	type ParsedTitle,
	parseInlineTags,
	readPriority,
} from "#/lib/tags/inline-tags";
import type { Stage } from "#/schemas/checklist";
import { dateOnlySchema } from "#/schemas/common";

/** Mirrors `descriptionSchema`, so a parsed description is always accepted. */
const MAX_DESCRIPTION = 500;

const HEADING = /^(#{1,6})\s+(.*)$/;

const LIST_MARKER = /^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;

export type OutlineChecklist = ChecklistTitle & {
	description: string;
	/** From a `deadline:` line; absent for none. */
	deadline?: string;
	/** `HH:MM`, from the same line; absent for the start of that day. */
	deadlineTime?: string;
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
			checklists.push({
				...parseChecklistTitle(heading[2]),
				description: "",
				tasks: [],
			});
			descriptions.push([]);
		} else if (current === undefined) {
			skipped += 1;
		} else if (heading) {
			const words = heading[2].trim();
			if (words !== "") descriptions[descriptions.length - 1].push(words);
		} else if (current.tasks.length === 0 && readSetting(line) !== null) {
			Object.assign(current, readSetting(line));
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

/** Mirrors `stagesSchema` and `stageNameSchema`. */
const MAX_STAGES = 12;
const MAX_STAGE_NAME = 30;

/** Stage names in brackets, each in double quotes: `["To do", "Done"]`. */
const STAGE_LIST = /\[\s*"[^"]*"(?:\s*,\s*"[^"]*")*\s*\]/;

const SETTING = /^(deadline|stages)\s*:\s*(.*)$/i;

const DEADLINE = /^(\d{4}-\d{2}-\d{2})(?:\s+([01]\d|2[0-3]):([0-5]\d))?$/;

/**
 * A `deadline:` or `stages:` line under a heading, as what it sets; `null`
 * for any other line, or one whose value cannot be read.
 */
function readSetting(
	line: string,
): Pick<OutlineChecklist, "deadline" | "deadlineTime" | "stages"> | null {
	const match = SETTING.exec(line);
	if (match === null) return null;
	const value = match[2].trim();

	if (match[1].toLowerCase() === "deadline") {
		const deadline = DEADLINE.exec(value);
		if (deadline === null || !v.is(dateOnlySchema, deadline[1])) return null;
		return {
			deadline: deadline[1],
			...(deadline[2] === undefined
				? {}
				: { deadlineTime: `${deadline[2]}:${deadline[3]}` }),
		};
	}

	const names =
		STAGE_LIST.exec(value)?.[0] === value ? stageNames(value) : null;
	return names === null ? null : { stages: asStages(names) };
}

/**
 * The names in a bracketed list, or `null` where they would not make stages:
 * fewer than two, one empty or too long, two alike.
 */
function stageNames(list: string): Array<string> | null {
	const names = (JSON.parse(list) as Array<string>).map((name) => name.trim());
	return names.length >= 2 &&
		names.length <= MAX_STAGES &&
		names.every((name) => name !== "" && name.length <= MAX_STAGE_NAME) &&
		new Set(names.map((name) => name.toLowerCase())).size === names.length
		? names
		: null;
}

function asStages(names: ReadonlyArray<string>): Array<Stage> {
	return names.map((name) => ({ stageId: createId(ID_PREFIX.stage), name }));
}

export type ChecklistTitle = {
	title: string;
	urgent: boolean;
	important: boolean;
	/** Absent where the title names none, for `DEFAULT_STAGES`. */
	stages?: Array<Stage>;
};

/**
 * A new checklist's title as typed, read for what it says beyond its name:
 *
 *     Python ["To do", "In progress", "Done"] -ui
 *
 * A closing `-u`, `-i` or `-ui` flags it, as a task's does; see
 * `readPriority`. Stage names in brackets give it those stages, in order, the
 * last being done. Both are taken off the title. A list that would not make
 * stages — fewer than two names, a name too long, two alike — is left in the
 * title as typed, and so is either one where nothing else would be left.
 */
export function parseChecklistTitle(text: string): ChecklistTitle {
	const typed = text.trim();
	const match = STAGE_LIST.exec(typed);
	const names = match === null ? null : stageNames(match[0]);
	const isStageList = match !== null && names !== null;

	const rest = isStageList
		? `${typed.slice(0, match.index)} ${typed.slice(match.index + match[0].length)}`
				.replace(/\s+/g, " ")
				.trim()
		: typed;
	const { title, urgent, important } = readPriority(rest);
	if (title === "") return { title: typed, urgent: false, important: false };

	return {
		title,
		urgent,
		important,
		...(names === null ? {} : { stages: asStages(names) }),
	};
}
