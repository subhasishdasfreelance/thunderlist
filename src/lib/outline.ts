/**
 * Reading a pasted Markdown outline into checklists and trackers, for a group
 * made from it in one go:
 *
 *     # Python -ui
 *     deadline: 2026-12-01
 *     stages: ["To do", "In review", "Done"]
 *     ## Async, typing, packaging
 *     python asyncio gather and cancellation -i
 *     fastapi middleware and error handling
 *
 *     # &Clean Code -i
 *     target: 464 pages
 *     start: 40
 *     type: book
 *     deadline: 2026-12-01
 *     ## Readable code, one chapter a day
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
 * A `#` heading led by `&` — the mark a task stands for a tracker with — starts
 * a tracker instead, read for its priority the same way. Under it, `target:`
 * says how far it goes, with its unit after the number; it is the one setting
 * a tracker cannot do without, and one with none is left out. `start:`,
 * `type:` (book, course, project, fitness or custom) and `deadline:` are as
 * the tracker's own form has them, and `##` its description. Any other line
 * under a tracker is left out.
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
import {
	TRACKER_TYPE_DEFAULT_UNITS,
	TRACKER_TYPES,
	type TrackerType,
} from "#/schemas/tracker";

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

export type OutlineTracker = {
	title: string;
	urgent: boolean;
	important: boolean;
	description: string;
	type: TrackerType;
	unit: string;
	targetValue: number;
	startValue: number;
	/** From a `deadline:` line; absent for none. */
	deadline?: string;
	/** `HH:MM`, from the same line; absent for the start of that day. */
	deadlineTime?: string;
};

export type Outline = {
	checklists: Array<OutlineChecklist>;
	trackers: Array<OutlineTracker>;
	/**
	 * Lines left out: above the first `#` heading, which belong to nothing,
	 * and under a tracker, where only its settings mean anything.
	 */
	skipped: number;
	/** Trackers with no `target:` line, which are left out whole. */
	untargeted: number;
};

/** A `# &Name` heading: a tracker, not a checklist. */
const TRACKER_HEADING = /^&\s*(.+)$/;

/** A tracker being read, before its target is known. */
type DraftTracker = Omit<OutlineTracker, "unit" | "targetValue"> & {
	unit?: string;
	targetValue?: number;
};

export function parseOutline(text: string): Outline {
	// In the order written, so each `##` line finds what it describes.
	const items: Array<
		| { kind: "checklist"; checklist: OutlineChecklist }
		| { kind: "tracker"; tracker: DraftTracker }
	> = [];
	const descriptions: Array<Array<string>> = [];
	let skipped = 0;

	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (line === "") continue;

		const heading = HEADING.exec(line);
		const current = items.at(-1);

		if (heading && heading[1].length === 1 && heading[2].trim() !== "") {
			const tracker = TRACKER_HEADING.exec(heading[2].trim());
			items.push(
				tracker === null
					? {
							kind: "checklist",
							checklist: {
								...parseChecklistTitle(heading[2]),
								description: "",
								tasks: [],
							},
						}
					: {
							kind: "tracker",
							tracker: {
								...readPriority(tracker[1].trim()),
								description: "",
								type: "custom",
								startValue: 0,
							},
						},
			);
			descriptions.push([]);
		} else if (current === undefined) {
			skipped += 1;
		} else if (heading) {
			const words = heading[2].trim();
			if (words !== "") descriptions[descriptions.length - 1].push(words);
		} else if (current.kind === "tracker") {
			const setting = readTrackerSetting(line);
			if (setting === null) skipped += 1;
			else Object.assign(current.tracker, setting);
		} else if (
			current.checklist.tasks.length === 0 &&
			readSetting(line) !== null
		) {
			Object.assign(current.checklist, readSetting(line));
		} else {
			const parsed = parseInlineTags(line.replace(LIST_MARKER, ""));
			if (parsed.title !== "") current.checklist.tasks.push(parsed);
		}
	}

	const checklists: Array<OutlineChecklist> = [];
	const trackers: Array<OutlineTracker> = [];
	let untargeted = 0;

	items.forEach((item, at) => {
		const description = descriptions[at]
			.join("\n")
			.slice(0, MAX_DESCRIPTION)
			.trim();

		if (item.kind === "checklist") {
			checklists.push({ ...item.checklist, description });
		} else if (item.tracker.targetValue === undefined) {
			untargeted += 1;
		} else {
			trackers.push({
				...item.tracker,
				description,
				targetValue: item.tracker.targetValue,
				unit:
					item.tracker.unit ?? TRACKER_TYPE_DEFAULT_UNITS[item.tracker.type],
			});
		}
	});

	return { checklists, trackers, skipped, untargeted };
}

/** Mirrors `targetValueSchema`, `progressValueSchema` and `unitSchema`. */
const MAX_TRACKER_VALUE = 1_000_000;
const MAX_UNIT = 24;

const TRACKER_SETTING = /^(target|start|type|deadline)\s*:\s*(.*)$/i;

/** A number, then what it counts, if said: `464 pages`. */
const AMOUNT = /^(\d+(?:\.\d+)?)(?:\s+(.+))?$/;

/**
 * A `target:`, `start:`, `type:` or `deadline:` line under a tracker, as what
 * it sets; `null` for any other line, or one whose value cannot be read.
 */
function readTrackerSetting(line: string): Partial<DraftTracker> | null {
	const match = TRACKER_SETTING.exec(line);
	if (match === null) return null;
	const value = match[2].trim();

	switch (match[1].toLowerCase()) {
		case "target": {
			const amount = AMOUNT.exec(value);
			if (amount === null) return null;
			const target = Number(amount[1]);
			const unit = amount[2]?.trim();
			if (target <= 0 || target > MAX_TRACKER_VALUE) return null;
			if (unit !== undefined && unit.length > MAX_UNIT) return null;
			return {
				targetValue: target,
				...(unit === undefined ? {} : { unit }),
			};
		}
		case "start": {
			const start = AMOUNT.exec(value);
			if (start === null || start[2] !== undefined) return null;
			const at = Number(start[1]);
			return at > MAX_TRACKER_VALUE ? null : { startValue: at };
		}
		case "type": {
			const type = TRACKER_TYPES.find((each) => each === value.toLowerCase());
			return type === undefined ? null : { type };
		}
		default:
			return readSetting(`deadline: ${value}`);
	}
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
