/**
 * Tags. Server only.
 *
 * Tags are their own collection and tasks reference them by id. That
 * indirection is the whole point: recolouring a tag is a single document write,
 * however many tasks carry it, and a task keeps its tag whatever the tag is
 * called. Renaming also rewrites the `#name` written in the titles of the tasks
 * carrying it, because the title is where a name is read back from; see
 * `renameInTitles`.
 *
 * Two tags are special: Today and the Backlog. Every account has them, they are
 * made the first time its tags are read, and they cannot be deleted; see
 * `SPECIAL_TAGS`.
 *
 * Every function here takes the owner first and filters on it. A tag id names
 * a row; the owner is what decides whether it is yours.
 */

import { type AnyBulkWriteOperation, MongoServerError } from "mongodb";
import { AppError } from "#/lib/errors";
import { createId, ID_PREFIX } from "#/lib/ids";
import {
	type Collections,
	collections,
	DOMAIN_FIELDS,
	type TaskDoc,
} from "#/lib/mongo/client.server";
import { reachedTargetOn, trackerProgress } from "#/lib/progress";
import {
	isInlineTagName,
	renameInlineTag,
	withInlineTag,
} from "#/lib/tags/inline-tags";
import { calculateChecklistProgress } from "#/lib/tasks/tasks";
import { type DailyWindow, DEFAULT_DAILY_WINDOW } from "#/schemas/common";
import {
	SPECIAL_TAGS,
	type SpecialTag,
	type Tag,
	type TagColor,
	type TagDetail,
	type TagSummary,
	type TagTaskEntry,
} from "#/schemas/tag";
import type { Task } from "#/schemas/task";
import { removeTagFromTasks, withTrackedCompletion } from "./checklist.server";
import { summarise as summariseTracker } from "./tracker.server";

function byName(a: Tag, b: Tag): number {
	return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** The special tags first, Today before the Backlog, then the rest by name. */
function inOrder(a: Tag, b: Tag): number {
	const rank = (tag: Tag) =>
		tag.special === null
			? SPECIAL_TAGS.length
			: SPECIAL_TAGS.indexOf(tag.special);

	return rank(a) - rank(b) || byName(a, b);
}

/**
 * A stored tag with every field filled in.
 *
 * Tags made before they had a schedule, or before any tag was special, have
 * none of those fields at all, and a missing field means the same as an empty
 * one.
 */
function withSchedule(tag: Tag): Tag {
	return {
		...tag,
		special: tag.special ?? null,
		description: tag.description ?? "",
		startDate: tag.startDate ?? null,
		deadline: tag.deadline ?? null,
		deadlineTime: tag.deadlineTime ?? null,
		dailyWindow: tag.dailyWindow ?? null,
	};
}

/**
 * A tag with its progress: the share of the tasks carrying it that are done,
 * counted exactly as a checklist's are. Its pace is judged in the browser, on
 * the viewer's own clock, which this server does not know; see `usePace`.
 */
function summarise(
	tag: Tag,
	tasks: ReadonlyArray<Pick<Task, "completed">>,
): TagSummary {
	return { ...tag, progress: calculateChecklistProgress(tasks) };
}

/* -------------------------------------------------------------------------- */
/* Special tags                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The colour each special tag starts in. Today takes the gold of the app's
 * bolt, which is the mark that puts a task on it; the Backlog is grey, because
 * parked work should not compete for attention.
 */
const SPECIAL_TAG_COLORS: Record<SpecialTag, TagColor> = {
	today: "yellow",
	backlog: "gray",
};

/** Accounts whose special tags this server has already seen to. */
const ensured = new Set<string>();

/** Two first requests raced to make the same special tag; the other won. */
function isDuplicateKey(error: unknown): boolean {
	return error instanceof MongoServerError && error.code === 11000;
}

/**
 * Make sure an account has both special tags, and nothing left on the lists
 * they replaced.
 *
 * Called on the way into every read of the tags, so a new account has them
 * before its first screen is drawn. A tag the account already has by that name
 * becomes the special one, rather than the account ending up with two tags it
 * cannot tell apart. The unique index on `(userId, special)` is what settles
 * two first requests arriving at once.
 */
async function ensureSpecialTags(userId: string): Promise<void> {
	if (ensured.has(userId)) return;

	const current = await collections();

	for (const kind of SPECIAL_TAGS) {
		const existing = await current.tags.findOne(
			{ userId, special: kind },
			{ projection: { _id: 1 } },
		);
		if (existing) continue;

		try {
			const named = await current.tags.findOneAndUpdate(
				{
					userId,
					special: null,
					name: { $regex: `^${escapeRegex(kind)}$`, $options: "i" },
				},
				{ $set: { special: kind } },
			);
			if (named) continue;

			const now = new Date().toISOString();
			await current.tags.insertOne({
				tagId: createId(ID_PREFIX.tag),
				name: kind,
				color: SPECIAL_TAG_COLORS[kind],
				special: kind,
				description: "",
				startDate: null,
				deadline: null,
				deadlineTime: null,
				// Today is one day long, every day: paced from morning to night.
				dailyWindow: kind === "today" ? DEFAULT_DAILY_WINDOW : null,
				createdAt: now,
				updatedAt: now,
				userId,
			});
		} catch (error) {
			if (!isDuplicateKey(error)) throw error;
		}
	}

	await moveListsIntoTags(current, userId);
	ensured.add(userId);
}

/**
 * Today and the Backlog used to be lists of their own, holding references to
 * tasks. They are tags now, so whatever an account still has on them is
 * written onto each task as its tag — into the title, as the bolt would write
 * it — and the references are dropped. After the first time this finds
 * nothing.
 */
async function moveListsIntoTags(
	current: Collections,
	userId: string,
): Promise<void> {
	const refs = await current.taskRefs
		.find({ userId }, { projection: { _id: 0, itemId: 1, taskId: 1, list: 1 } })
		.toArray();
	if (refs.length === 0) return;

	const [specials, tasks] = await Promise.all([
		current.tags
			.find(
				{ userId, special: { $in: [...SPECIAL_TAGS] } },
				{ projection: DOMAIN_FIELDS },
			)
			.toArray(),
		current.tasks
			.find(
				{ userId, taskId: { $in: refs.map((ref) => ref.taskId) } },
				{ projection: { _id: 0, taskId: 1, title: 1 } },
			)
			.toArray(),
	]);

	const titles = new Map(tasks.map((task) => [task.taskId, task.title]));
	const writes: Array<AnyBulkWriteOperation<TaskDoc>> = [];

	for (const ref of refs) {
		const tag = specials.find((each) => each.special === ref.list);
		const title = titles.get(ref.taskId);
		if (!tag || title === undefined) continue;

		// Carried forward, so a task that was somehow on both lists gets both.
		const next = withInlineTag(title, tag.name);
		titles.set(ref.taskId, next);

		writes.push({
			updateOne: {
				filter: { userId, taskId: ref.taskId },
				update: { $set: { title: next }, $addToSet: { tagIds: tag.tagId } },
			},
		});
	}

	if (writes.length > 0) await current.tasks.bulkWrite(writes);

	await current.taskRefs.deleteMany({
		userId,
		itemId: { $in: refs.map((ref) => ref.itemId) },
	});
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

export async function listTags(userId: string): Promise<Array<Tag>> {
	await ensureSpecialTags(userId);

	const current = await collections();
	const tags = await current.tags
		.find({ userId }, { projection: DOMAIN_FIELDS })
		.toArray();

	return tags.map(withSchedule).sort(inOrder);
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

	const [tags, stored, trackers] = await Promise.all([
		listTags(userId),
		current.tasks
			.find(
				{ userId },
				{
					projection: {
						_id: 0,
						tagIds: 1,
						completed: 1,
						trackerId: 1,
						linkedChecklistId: 1,
					},
				},
			)
			.toArray(),
		current.trackers
			.find(
				{ userId },
				{
					projection: {
						_id: 0,
						tagIds: 1,
						currentValue: 1,
						targetValue: 1,
						startValue: 1,
					},
				},
			)
			.toArray(),
	]);

	// Counted the way a checklist counts, so a task finished by its tracker is
	// done here as well.
	const tasks = await withTrackedCompletion(current, userId, stored);

	// A tracker counts once under each tag it carries, done at its target.
	const items = [
		...tasks,
		...trackers.map((tracker) => ({
			tagIds: tracker.tagIds ?? [],
			completed:
				trackerProgress(
					tracker.currentValue,
					tracker.targetValue,
					tracker.startValue,
				).percent >= 100,
		})),
	];

	const byTag = new Map<string, Array<Pick<Task, "completed">>>();
	for (const item of items) {
		for (const tagId of item.tagIds) {
			const existing = byTag.get(tagId);
			if (existing) existing.push(item);
			else byTag.set(tagId, [item]);
		}
	}

	return tags.map((tag) => summarise(tag, byTag.get(tag.tagId) ?? []));
}

/**
 * A tag by its id — or a special tag by its kind, `today` rather than its id;
 * see `tagParam`.
 */
async function findTag(
	current: Collections,
	userId: string,
	tagIdOrKind: string,
): Promise<Tag> {
	const kind = SPECIAL_TAGS.find((each) => each === tagIdOrKind);
	if (kind !== undefined) await ensureSpecialTags(userId);

	const found = await current.tags.findOne(
		kind === undefined
			? { tagId: tagIdOrKind, userId }
			: { special: kind, userId },
		{ projection: DOMAIN_FIELDS },
	);
	if (!found) throw new AppError("not_found", "That tag no longer exists.");

	return withSchedule(found);
}

/**
 * Every task carrying a tag, from whichever checklist — or none.
 *
 * Each comes with the title of the checklist it lives in, because on a tag's
 * page that is the one thing a row cannot take for granted.
 */
async function readTagEntries(
	current: Collections,
	userId: string,
	tagId: string,
): Promise<Array<TagTaskEntry>> {
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

	return tasks.map(({ checklistId, ...task }) => ({
		task,
		checklistId,
		checklistTitle:
			checklistId === null ? null : (titles.get(checklistId) ?? null),
	}));
}

/**
 * One tag: its progress, its trackers and the open tasks carrying it.
 *
 * Every task is counted, but only the open ones come back: the finished ones
 * are read on their own once the screen has settled; see `getTagCompleted`.
 */
export async function getTag(
	userId: string,
	tagIdOrKind: string,
): Promise<TagDetail> {
	const current = await collections();
	const tag = await findTag(current, userId, tagIdOrKind);
	const { tagId } = tag;

	const trackersRead = current.trackers
		.find({ userId, tagIds: tagId }, { projection: DOMAIN_FIELDS })
		.toArray();

	const [entries, trackers, readings] = await Promise.all([
		readTagEntries(current, userId, tagId),
		trackersRead,
		// Only for the day each tracker reached its target, which the chart needs.
		trackersRead.then((found) =>
			found.length === 0
				? []
				: current.entries
						.find(
							{
								userId,
								trackerId: { $in: found.map((tracker) => tracker.trackerId) },
							},
							{ projection: DOMAIN_FIELDS },
						)
						.toArray(),
		),
	]);

	const trackerEntries = trackers.map((tracker) => ({
		tracker: summariseTracker(tracker),
		completedOn: reachedTargetOn(
			readings.filter((reading) => reading.trackerId === tracker.trackerId),
			tracker.targetValue,
			tracker.startValue,
		),
	}));

	return {
		...summarise(tag, [
			...entries.map((entry) => entry.task),
			// A tracker counts as one more thing to finish, done at its target.
			...trackerEntries.map((entry) => ({
				completed: entry.tracker.progress.percent >= 100,
			})),
		]),
		tasks: entries.filter((entry) => !entry.task.completed),
		trackers: trackerEntries,
	};
}

/**
 * The finished tasks carrying a tag, read after the rest of its screen.
 *
 * They are the long tail of a tag and nobody is waiting on them, so they are
 * not part of `getTag`; see `useWhenIdle`.
 */
export async function getTagCompleted(
	userId: string,
	tagIdOrKind: string,
): Promise<Array<TagTaskEntry>> {
	const current = await collections();
	const tag = await findTag(current, userId, tagIdOrKind);

	const entries = await readTagEntries(current, userId, tag.tagId);
	return entries.filter((entry) => entry.task.completed);
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                    */
/* -------------------------------------------------------------------------- */

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
		deadlineTime: string | null;
		dailyWindow: DailyWindow | null;
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
		special: null,
		description: input.description,
		startDate: input.startDate,
		deadline: input.deadline,
		deadlineTime: input.deadlineTime,
		dailyWindow: input.dailyWindow,
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
		deadlineTime?: string | null;
		dailyWindow?: DailyWindow | null;
	},
): Promise<Tag> {
	const current = await collections();

	const before = await current.tags.findOne(
		{ tagId, userId },
		{ projection: DOMAIN_FIELDS },
	);
	if (!before) throw new AppError("not_found", "That tag no longer exists.");

	if (patch.name !== undefined) {
		// The bolt writes a special tag into titles by name, so its name has to
		// be one that reads back as the same tag.
		if (before.special && !isInlineTagName(patch.name)) {
			throw new AppError(
				"invalid_data",
				"This tag is written into tasks as #name, so its name must be one word.",
			);
		}

		await assertNameIsFree(userId, patch.name, tagId);
	}

	const next = await current.tags.findOneAndUpdate(
		{ tagId, userId },
		{ $set: { ...patch, updatedAt: new Date().toISOString() } },
		{ returnDocument: "after", projection: DOMAIN_FIELDS },
	);

	if (!next) throw new AppError("not_found", "That tag no longer exists.");

	if (patch.name !== undefined && patch.name !== before.name) {
		await renameInTitles(current, userId, tagId, before.name, patch.name);
	}

	return withSchedule(next);
}

/**
 * Rewrite `#old` as `#new` in the title of every task carrying a renamed tag.
 *
 * A task references its tags by id, but it also writes them into its title by
 * name, and that is what an edit reads them back from. A title still saying
 * `#today` after the tag became `#doing` would be read as a different tag the
 * next time the task was saved.
 */
async function renameInTitles(
	current: Collections,
	userId: string,
	tagId: string,
	from: string,
	to: string,
): Promise<void> {
	const carrying = await current.tasks
		.find(
			{ userId, tagIds: tagId },
			{ projection: { _id: 0, taskId: 1, title: 1 } },
		)
		.toArray();

	const writes: Array<AnyBulkWriteOperation<TaskDoc>> = carrying.flatMap(
		(task) => {
			const title = renameInlineTag(task.title, from, to);

			return title === task.title
				? []
				: [
						{
							updateOne: {
								filter: { userId, taskId: task.taskId },
								update: { $set: { title } },
							},
						},
					];
		},
	);

	if (writes.length > 0) await current.tasks.bulkWrite(writes);
}

/**
 * Delete a tag and take it off every task, checklist and tracker carrying it.
 *
 * A special tag is refused: the row's bolt and menu write it, so it has to
 * exist. The tag itself goes last: a tag still listed but stripped from its
 * tasks is recoverable by re-applying it, whereas tasks left pointing at a tag
 * that no longer exists would render as nothing at all.
 */
export async function deleteTag(userId: string, tagId: string): Promise<void> {
	const current = await collections();

	const tag = await current.tags.findOne(
		{ tagId, userId },
		{ projection: { _id: 0, special: 1 } },
	);
	if (tag?.special) {
		throw new AppError(
			"invalid_data",
			"This tag can be renamed, but not deleted.",
		);
	}

	await removeTagFromTasks(userId, tagId);
	await Promise.all([
		current.checklists.updateMany(
			{ userId, tagIds: tagId },
			{ $pull: { tagIds: tagId } },
		),
		current.trackers.updateMany(
			{ userId, tagIds: tagId },
			{ $pull: { tagIds: tagId } },
		),
	]);
	// Already gone is the outcome this asked for, not a failure.
	await current.tags.deleteOne({ tagId, userId });
}
