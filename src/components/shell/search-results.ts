import type { SearchIndex } from "#/data/search.server";
import { formatDate, formatDeadline } from "#/lib/format-date";
import { checklistStages, type Stage, stageColor } from "#/schemas/checklist";
import type { Countdown } from "#/schemas/countdown";
import type { Group } from "#/schemas/group";
import {
	formatNumber,
	type NumberedKind,
	parseNumberQuery,
} from "#/schemas/number";
import type { PlanSummary } from "#/schemas/plan";
import { type Tag, type TagColor, tagParam, tagsFor } from "#/schemas/tag";

export type Result = {
	key: string;
	/** `T-42`; absent for something made a moment ago and not yet numbered. */
	number?: string;
	label: string;
	context: string;
	to: string;
	/**
	 * The one row to bring into view once the page opens, for a result that is
	 * a row on a page rather than the page itself: a task, a tracker's reading,
	 * a countdown. The page scrolls to it and rings it; see `useFocusRow`.
	 */
	focus?: { task?: string; entry?: string; countdown?: string };
	/**
	 * For a task, the stage it is at in its checklist, in that stage's colour —
	 * `null` for the first stage, which has none; see `stageColor`.
	 */
	stage?: { name: string; color: TagColor | null };
};

/** What search looks through: the index, and the lists the app already holds. */
export type Sources = {
	index: SearchIndex;
	tags: ReadonlyArray<Tag>;
	plans: ReadonlyArray<PlanSummary>;
	countdowns: ReadonlyArray<Countdown>;
	groups: ReadonlyArray<Group>;
};

const MAX_PER_GROUP = 6;

function matches(haystack: string, needle: string): boolean {
	return haystack.toLowerCase().includes(needle);
}

/**
 * Everything a search finds, grouped by kind.
 *
 * A search for a number — `T-42`, `tr7` — finds that one thing and nothing
 * else. A bare `42` finds each kind's 42 first, then anything with 42 in its
 * name. Anything else is matched against names — and a task's caption and
 * notes, and a tracker's caption, as well.
 */
export function searchResults(query: string, sources: Sources): Array<Result> {
	const needle = query.trim().toLowerCase();
	if (needle === "") return [];

	const asked = parseNumberQuery(needle);
	const isNumbered = (kind: NumberedKind, number: number | undefined) =>
		asked !== null &&
		(asked.kind === null || asked.kind === kind) &&
		number === asked.number;
	// A prefixed number names one thing; its words are not searched for.
	const searchesWords = asked === null || asked.kind === null;
	/** The items of one kind a search finds: by number first, then by name. */
	function found<T>(
		kind: NumberedKind,
		items: ReadonlyArray<T>,
		numberOf: (item: T) => number | undefined,
		named: (item: T) => boolean,
	): Array<T> {
		const byNumber = items.filter((item) => isNumbered(kind, numberOf(item)));
		const byName = searchesWords
			? items.filter((item) => !byNumber.includes(item) && named(item))
			: [];
		return [...byNumber, ...byName].slice(0, MAX_PER_GROUP);
	}
	const numbered = (kind: NumberedKind, number: number | undefined) =>
		number === undefined ? undefined : formatNumber(kind, number);

	const { index, tags } = sources;

	const checklists = found(
		"checklist",
		index.checklists,
		(item) => item.number,
		(item) => matches(item.title, needle),
	).map((item) => ({
		key: `chk-${item.checklistId}`,
		number: numbered("checklist", item.number),
		label: item.title,
		context: "Checklist",
		to: `/checklists/${item.checklistId}`,
	}));

	/*
	 * A task is found by its title, its caption or its notes — the title first,
	 * since a word in the name is the likelier thing to be after — and a result
	 * found only further in says where; see `foundIn`.
	 *
	 * A task result opens the page the task is actually on and scrolls to it:
	 * its checklist, or — for one that belongs to no checklist — the page of
	 * the first tag it carries. A task with neither has nowhere to be shown,
	 * so it is not offered rather than opening a page it is not on.
	 */
	const inTitle = (item: SearchIndex["tasks"][number]) =>
		matches(item.title, needle);
	const foundIn = (item: SearchIndex["tasks"][number]) =>
		inTitle(item)
			? null
			: matches(item.caption, needle)
				? "caption"
				: matches(item.notes ?? "", needle)
					? "notes"
					: null;
	const tasks = found(
		"task",
		[
			...index.tasks.filter(inTitle),
			...index.tasks.filter((item) => !inTitle(item)),
		],
		(item) => item.number,
		(item) => inTitle(item) || foundIn(item) !== null,
	).flatMap((item): Array<Result> => {
		const home =
			item.checklistId === null
				? (tagsFor(item.tagIds, tags)[0] ?? null)
				: null;
		const to =
			item.checklistId !== null
				? `/checklists/${item.checklistId}`
				: home !== null
					? `/tags/${tagParam(home)}`
					: null;
		if (to === null) return [];

		const where =
			item.checklistTitle !== null
				? item.checklistTitle
				: home !== null
					? `#${home.name}`
					: "Task";
		const inside = foundIn(item);

		return [
			{
				key: `tsk-${item.taskId}`,
				number: numbered("task", item.number),
				label: item.title,
				context: inside === null ? where : `${where} · in its ${inside}`,
				to,
				focus: { task: item.taskId },
				stage: stageAt(
					item,
					checklistStages(
						index.checklists.find(
							(checklist) => checklist.checklistId === item.checklistId,
						) ?? {},
					),
				),
			},
		];
	});

	const trackers = found(
		"tracker",
		index.trackers,
		(item) => item.number,
		(item) =>
			matches(item.title, needle) ||
			(item.author !== null && matches(item.author, needle)) ||
			(item.caption !== undefined && matches(item.caption, needle)),
	).map((item) => ({
		key: `trk-${item.trackerId}`,
		number: numbered("tracker", item.number),
		label: item.title,
		context: item.caption ? `Tracker · ${item.caption}` : "Tracker",
		to: `/trackers/${item.trackerId}`,
	}));

	// A reading has no name of its own: it is found by its number or its note.
	const entries = found(
		"entry",
		index.entries,
		(item) => item.number,
		(item) => item.note !== "" && matches(item.note, needle),
	).map((item) => {
		const tracker = index.trackers.find(
			(each) => each.trackerId === item.trackerId,
		);
		return {
			key: `ent-${item.entryId}`,
			number: numbered("entry", item.number),
			label: `${item.value}${item.note === "" ? "" : ` · ${item.note}`}`,
			context: `${tracker?.title ?? "Tracker"} · ${formatDate(item.recordedAt)}`,
			to: `/trackers/${item.trackerId}`,
			focus: { entry: item.entryId },
		};
	});

	const tagResults = found(
		"tag",
		tags,
		(item) => item.number,
		(item) => matches(item.name, needle),
	).map((item) => ({
		key: `tag-${item.tagId}`,
		number: numbered("tag", item.number),
		label: `#${item.name}`,
		context: "Tag",
		to: `/tags/${tagParam(item)}`,
	}));

	const plans = found(
		"plan",
		sources.plans,
		(item) => item.number,
		(item) => matches(item.title, needle),
	).map((item) => ({
		key: `pln-${item.planId}`,
		number: numbered("plan", item.number),
		label: item.title,
		context: "Plan",
		to: `/plans/${item.planId}`,
	}));

	const countdowns = found(
		"countdown",
		sources.countdowns,
		(item) => item.number,
		(item) => matches(item.title, needle),
	).map((item) => ({
		key: `cdn-${item.countdownId}`,
		number: numbered("countdown", item.number),
		label: item.title,
		context: `Countdown · ${formatDeadline(item.date, item.time)}`,
		to: "/countdowns",
		focus: { countdown: item.countdownId },
	}));

	const groups = found(
		"group",
		sources.groups,
		(item) => item.number,
		(item) => matches(item.name, needle),
	).map((item) => ({
		key: `grp-${item.groupId}`,
		number: numbered("group", item.number),
		label: item.name,
		context: "Group",
		to: `/groups/${item.groupId}`,
	}));

	return [
		...checklists,
		...tasks,
		...trackers,
		...entries,
		...tagResults,
		...plans,
		...countdowns,
		...groups,
	];
}

/** Where a task is along its checklist, as its row there draws it. */
function stageAt(
	task: { stageId?: string | null; completed: boolean },
	stages: ReadonlyArray<Stage>,
): Result["stage"] {
	const at = stages.findIndex((stage) => stage.stageId === task.stageId);
	const index = at === -1 ? (task.completed ? stages.length - 1 : 0) : at;
	return {
		name: stages[index].name,
		color: index === 0 ? null : stageColor(stages, index),
	};
}
