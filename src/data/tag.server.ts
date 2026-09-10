/**
 * Tags. Server only.
 *
 * Tags are their own collection and tasks reference them by id. That
 * indirection is the whole point: renaming or recolouring a tag is a single
 * document write, however many tasks carry it, and a task can never end up
 * showing a stale copy of a name.
 *
 * Every function here takes the owner first and filters on it. A tag id names
 * a row; the owner is what decides whether it is yours.
 */

import { AppError } from "#/lib/errors";
import {
	collections,
	DOMAIN_FIELDS,
	type TaskDoc,
} from "#/lib/mongo/client.server";
import { paceStatus } from "#/lib/progress";
import { calculateChecklistProgress } from "#/lib/tasks/tasks";
import {
	type Tag,
	type TagColor,
	type TagDetail,
	type TagSummary,
	tagStartDate,
} from "#/schemas/tag";
import type { Task } from "#/schemas/task";
import { removeTagFromTasks, withTrackedCompletion } from "./checklist.server";

function byName(a: Tag, b: Tag): number {
	return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/**
 * A stored tag with its schedule filled in.
 *
 * Tags made before they had a schedule have none of its fields at all, and a
 * missing field means the same as an empty one.
 */
function withSchedule(tag: Tag): Tag {
	return {
		...tag,
		description: tag.description ?? "",
		startDate: tag.startDate ?? null,
		deadline: tag.deadline ?? null,
	};
}

/**
 * A tag with its progress, judged exactly as a checklist's is: the share of
 * the tasks carrying it that are done, against its own dates.
 */
function summarise(
	tag: Tag,
	tasks: ReadonlyArray<Pick<Task, "completed">>,
): TagSummary {
	const progress = calculateChecklistProgress(tasks);

	return {
		...tag,
		progress,
		status:
			progress.total === 0
				? null
				: paceStatus({
						startDate: tagStartDate(tag),
						deadline: tag.deadline,
						fractionComplete: progress.completed / progress.total,
					}),
	};
}

export async function listTags(userId: string): Promise<Array<Tag>> {
	const current = await collections();
	const tags = await current.tags
		.find({ userId }, { projection: DOMAIN_FIELDS })
		.toArray();

	return tags.map(withSchedule).sort(byName);
}

/**
 * Every tag with its progress, for the Tags screen.
 *
 * Kept apart from `listTags`, which most screens read for names and colours
 * alone: counting means reading every task, and a screen that only highlights
 * `#name` should not pay for that.
 */
export async function listTagSummaries(
	userId: string,
): Promise<Array<TagSummary>> {
	const current = await collections();

	const [tags, stored] = await Promise.all([
		listTags(userId),
		current.tasks
			.find(
				{ userId },
				{ projection: { _id: 0, tagIds: 1, completed: 1, trackerId: 1 } },
			)
			.toArray(),
	]);

	// Counted the way a checklist counts, so a task finished by its tracker is
	// done here as well.
	const tasks = await withTrackedCompletion(current, userId, stored);

	const byTag = new Map<string, Array<Pick<Task, "completed">>>();
	for (const task of tasks) {
		for (const tagId of task.tagIds) {
			const existing = byTag.get(tagId);
			if (existing) existing.push(task);
			else byTag.set(tagId, [task]);
		}
	}

	return tags.map((tag) => summarise(tag, byTag.get(tag.tagId) ?? []));
}

/**
 * One tag and every task carrying it, from whichever checklist — or none.
 *
 * Each task comes with the title of the checklist it lives in, because on a
 * tag's page that is the one thing a row cannot take for granted.
 */
export async function getTag(
	userId: string,
	tagId: string,
): Promise<TagDetail> {
	const current = await collections();

	const tag = await current.tags.findOne(
		{ tagId, userId },
		{ projection: DOMAIN_FIELDS },
	);
	if (!tag) throw new AppError("not_found", "That tag no longer exists.");

	const stored = await current.tasks
		.find({ userId, tagIds: tagId })
		.project<TaskDoc>(DOMAIN_FIELDS)
		.toArray();

	const checklistIds = [
		...new Set(
			stored.flatMap((task) =>
				task.checklistId === null ? [] : [task.checklistId],
			),
		),
	];

	const [checklists, tasks] = await Promise.all([
		current.checklists
			.find(
				{ userId, checklistId: { $in: checklistIds } },
				{ projection: { _id: 0, checklistId: 1, title: 1 } },
			)
			.toArray(),
		// Finished by its tracker counts as finished; see `withTrackedCompletion`.
		withTrackedCompletion(current, userId, stored),
	]);

	const titles = new Map(
		checklists.map((checklist) => [checklist.checklistId, checklist.title]),
	);

	return {
		...summarise(withSchedule(tag), tasks),
		tasks: tasks.map(({ checklistId, ...task }) => ({
			task,
			checklistId,
			checklistTitle:
				checklistId === null ? null : (titles.get(checklistId) ?? null),
		})),
	};
}

/**
 * Names are compared case-insensitively so "Urgent" and "urgent" cannot both
 * exist: two tags that look identical in a list are indistinguishable to the
 * person picking one. The clash only has to be checked within one account —
 * two people may each have an "urgent", and neither ever sees the other's.
 */
async function assertNameIsFree(
	userId: string,
	name: string,
	exceptTagId?: string,
): Promise<void> {
	const current = await collections();
	const taken = await current.tags.findOne({
		userId,
		name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
		...(exceptTagId === undefined ? {} : { tagId: { $ne: exceptTagId } }),
	});

	if (taken) {
		throw new AppError("invalid_data", `There is already a "${name}" tag.`);
	}
}

/** A tag name is free text, so it is matched literally rather than as a pattern. */
function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function createTag(
	userId: string,
	input: {
		tagId: string;
		name: string;
		color: TagColor;
		description: string;
		startDate: string | null;
		deadline: string | null;
	},
): Promise<Tag> {
	const current = await collections();

	// Queuing the same new tag twice, or applying a batch a second time, should
	// settle rather than fail.
	const existing = await current.tags.findOne(
		{ tagId: input.tagId, userId },
		{ projection: DOMAIN_FIELDS },
	);
	if (existing) return withSchedule(existing);

	await assertNameIsFree(userId, input.name);

	const now = new Date().toISOString();
	// Listed field by field rather than spread: the caller passes the whole
	// queued change, and spreading it would store its `kind` alongside.
	const tag: Tag = {
		tagId: input.tagId,
		name: input.name,
		color: input.color,
		description: input.description,
		startDate: input.startDate,
		deadline: input.deadline,
		createdAt: now,
		updatedAt: now,
	};

	await current.tags.insertOne({ ...tag, userId });

	return tag;
}

export async function updateTag(
	userId: string,
	tagId: string,
	patch: {
		name?: string;
		color?: TagColor;
		description?: string;
		startDate?: string | null;
		deadline?: string | null;
	},
): Promise<Tag> {
	if (patch.name !== undefined) {
		await assertNameIsFree(userId, patch.name, tagId);
	}

	const current = await collections();
	const next = await current.tags.findOneAndUpdate(
		{ tagId, userId },
		{ $set: { ...patch, updatedAt: new Date().toISOString() } },
		{ returnDocument: "after", projection: DOMAIN_FIELDS },
	);

	if (!next) throw new AppError("not_found", "That tag no longer exists.");

	return withSchedule(next);
}

/**
 * Delete a tag and take it off every task carrying it.
 *
 * The tag itself goes last: a tag still listed but stripped from its tasks is
 * recoverable by re-applying it, whereas tasks left pointing at a tag that no
 * longer exists would render as nothing at all.
 */
export async function deleteTag(userId: string, tagId: string): Promise<void> {
	const current = await collections();

	await removeTagFromTasks(userId, tagId);
	// Already gone is the outcome this asked for, not a failure.
	await current.tags.deleteOne({ tagId, userId });
}
