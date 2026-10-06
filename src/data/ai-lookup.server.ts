/**
 * What an AI tool reads, and how it finds the thing a person named. Server
 * only; see `runAiTool`.
 *
 * Every read is the one a screen makes, filtered by the same scope, so an
 * agent sees exactly what its person would and nothing kept from them. Each is
 * made at most once a call, and only if the tool asks for it.
 */

import { AppError } from "#/lib/errors";
import {
	parseInlineTags,
	sameTagName,
	withoutInlineTag,
} from "#/lib/tags/inline-tags";
import { checklistStages, type Stage } from "#/schemas/checklist";
import {
	formatNumber,
	type NumberedKind,
	parseNumberQuery,
} from "#/schemas/number";
import { specialTag, type Tag } from "#/schemas/tag";
import type { TaskType } from "#/schemas/task-type";
import { listChecklists } from "./checklist.server";
import { listCountdowns } from "./countdown.server";
import { listPlans } from "./plan.server";
import { getSearchIndex, type SearchIndex } from "./search.server";
import { listGroups, listTaskTypes } from "./settings.server";
import { listTags } from "./tag.server";
import type { Scope } from "./team.server";
import { listTrackers } from "./tracker.server";

function once<T>(load: () => Promise<T>): () => Promise<T> {
	let loaded: Promise<T> | null = null;
	return () => {
		loaded ??= load();
		return loaded;
	};
}

export type IndexedTask = SearchIndex["tasks"][number];

/** The reads a tool can make, each made once however often it is asked for. */
export function createLookup(scope: Scope) {
	const { ownerId, hidden } = scope;
	return {
		index: once(() => getSearchIndex(ownerId, hidden)),
		tags: once(() => listTags(ownerId, hidden)),
		checklists: once(() => listChecklists(ownerId, hidden)),
		trackers: once(() => listTrackers(ownerId, hidden)),
		groups: once(async () =>
			(await listGroups(ownerId)).filter(
				(group) => !hidden.groupIds.has(group.groupId),
			),
		),
		plans: once(() => listPlans(ownerId, hidden)),
		countdowns: once(() => listCountdowns(ownerId, hidden)),
		taskTypes: once(() => listTaskTypes(ownerId)),
	};
}

export type Lookup = ReturnType<typeof createLookup>;

/**
 * The one item a reference names: its id, its number (`T-42`, or a bare `42`
 * among one kind) or its exact name, ignoring case. Refuses a name several
 * share, listing them, rather than guessing which was meant.
 */
export function pick<T>(
	what: string,
	items: ReadonlyArray<T>,
	ref: string,
	keys: {
		id: (item: T) => string;
		name: (item: T) => string;
		number?: { kind: NumberedKind; of: (item: T) => number | undefined };
	},
): T {
	const wanted = ref.trim();

	const byId = items.find((item) => keys.id(item) === wanted);
	if (byId !== undefined) return byId;

	const asked = parseNumberQuery(wanted);
	const { number } = keys;
	if (
		number !== undefined &&
		asked !== null &&
		(asked.kind === null || asked.kind === number.kind)
	) {
		const byNumber = items.find((item) => number.of(item) === asked.number);
		if (byNumber !== undefined) return byNumber;
	}

	const byName = items.filter(
		(item) => keys.name(item).trim().toLowerCase() === wanted.toLowerCase(),
	);
	if (byName.length === 1) return byName[0];
	if (byName.length > 1) {
		const which = byName
			.map((item) => {
				const at = number?.of(item);
				return at === undefined || number === undefined
					? keys.id(item)
					: formatNumber(number.kind, at);
			})
			.join(", ");
		throw new AppError(
			"invalid_data",
			`Several ${what}s are called "${wanted}" (${which}). Name one by its number or id.`,
		);
	}

	throw new AppError("not_found", `No ${what} matches "${wanted}".`);
}

/** A title without the `#tags` written in it; see `parseInlineTags`. */
function withoutTags(title: string): string {
	return parseInlineTags(title)
		.tagNames.reduce((text, name) => withoutInlineTag(text, name), title)
		.trim();
}

/**
 * A task by reference. Its name is matched with any `#tags` left out of both
 * sides, since a title is quoted with them as often as without.
 */
export async function findTask(
	look: Lookup,
	ref: string,
): Promise<IndexedTask> {
	return pick("task", (await look.index()).tasks, withoutTags(ref), {
		id: (task) => task.taskId,
		name: (task) => withoutTags(task.title),
		number: { kind: "task", of: (task) => task.number },
	});
}

/** A checklist by reference, or `inbox` / `backlog` for those two. */
export async function findChecklist(look: Lookup, ref: string) {
	const checklists = await look.checklists();
	const special = checklists.find(
		(checklist) => checklist.special === ref.trim().toLowerCase(),
	);
	if (special !== undefined) return special;

	return pick("checklist", checklists, ref, {
		id: (checklist) => checklist.checklistId,
		name: (checklist) => checklist.title,
		number: { kind: "checklist", of: (checklist) => checklist.number },
	});
}

/** A tag by reference, or `today` for Today, whatever it is called now. */
export async function findTag(look: Lookup, ref: string): Promise<Tag> {
	const tags = await look.tags();
	const special = tags.find((tag) => tag.special === ref.trim().toLowerCase());
	if (special !== undefined) return special;

	return pick("tag", tags, ref.replace(/^#/, ""), {
		id: (tag) => tag.tagId,
		name: (tag) => tag.name,
		number: { kind: "tag", of: (tag) => tag.number },
	});
}

export async function findTracker(look: Lookup, ref: string) {
	return pick("tracker", await look.trackers(), ref, {
		id: (tracker) => tracker.trackerId,
		name: (tracker) => tracker.title,
		number: { kind: "tracker", of: (tracker) => tracker.number },
	});
}

export async function findGroup(look: Lookup, ref: string) {
	return pick("group", await look.groups(), ref, {
		id: (group) => group.groupId,
		name: (group) => group.name,
		number: { kind: "group", of: (group) => group.number },
	});
}

export async function findPlan(look: Lookup, ref: string) {
	return pick("plan", await look.plans(), ref, {
		id: (plan) => plan.planId,
		name: (plan) => plan.title,
		number: { kind: "plan", of: (plan) => plan.number },
	});
}

export async function findCountdown(look: Lookup, ref: string) {
	return pick("countdown", await look.countdowns(), ref, {
		id: (countdown) => countdown.countdownId,
		name: (countdown) => countdown.title,
		number: { kind: "countdown", of: (countdown) => countdown.number },
	});
}

/** A task type by name or id; `none` or `null` for no type. */
export async function findTaskType(
	look: Lookup,
	ref: string | null,
): Promise<TaskType | null> {
	if (ref === null || ref.trim().toLowerCase() === "none") return null;
	return pick("task type", await look.taskTypes(), ref, {
		id: (type) => type.typeId,
		name: (type) => type.name,
	});
}

/** The stages of the checklist a task is in; the defaults for none. */
export async function stagesOf(
	look: Lookup,
	task: Pick<IndexedTask, "checklistId">,
): Promise<ReadonlyArray<Stage>> {
	const checklist = (await look.index()).checklists.find(
		(each) => each.checklistId === task.checklistId,
	);
	return checklistStages(checklist ?? {});
}

/** One of a checklist's stages by its name or id. */
export function findStage(stages: ReadonlyArray<Stage>, ref: string): Stage {
	return pick("stage", stages, ref, {
		id: (stage) => stage.stageId,
		name: (stage) => stage.name,
	});
}

export async function todayTag(look: Lookup): Promise<Tag> {
	const today = specialTag(await look.tags(), "today");
	if (today === null) {
		throw new AppError("not_found", "Today could not be found.");
	}
	return today;
}

/** An existing tag of this name, if there is one; see `createTagResolver`. */
export function tagNamed(
	tags: ReadonlyArray<Tag>,
	name: string,
): Tag | undefined {
	return tags.find((tag) => sameTagName(tag.name, name.replace(/^#/, "")));
}
