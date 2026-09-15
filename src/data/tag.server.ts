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
 * One tag is special: Today. Every account has it, it is made the first time
 * its tags are read, and it cannot be deleted; see `SPECIAL_TAGS`. The Backlog
 * was the other, and is a checklist now; see `ensureBacklog`.
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
import {
	calculateChecklistProgress,
	isAssignedTo,
	orderByTask,
	type Page,
	pageOf,
} from "#/lib/tasks/tasks";
import {
	checklistStages,
	isUnderway,
	type Stage,
	stageOf,
	stageProgress,
} from "#/schemas/checklist";
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
import type { TaskPageView } from "#/schemas/task";
import {
	ensureBacklog,
	ensureInbox,
	removeTagFromTasks,
	withTrackedCompletion,
} from "./checklist.server";
import { summarise as summariseTracker } from "./tracker.server";
import { type Hidden, isTaskVisible } from "./visibility.server";

function byName(a: Tag, b: Tag): number {
	return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** The special tags first, then the rest by name. */
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
 * counted exactly as a checklist's are, and how many of the rest are under
 * way; see `isUnderway`. Its pace is judged in the browser, on the viewer's
 * own clock, which this server does not know; see `usePace`.
 */
function summarise(
	tag: Tag,
	items: ReadonlyArray<{ completed: boolean; isUnderway?: boolean }>,
): TagSummary {
	return {
		...tag,
		progress: {
			...calculateChecklistProgress(items),
			inProgress: items.filter((item) => item.isUnderway === true).length,
		},
	};
}

/**
 * Tasks with whether each is under way, which takes the stages of the
 * checklists they live in; see `isUnderway`.
 */
async function withUnderway<
	T extends Pick<TaskDoc, "checklistId" | "stageId" | "completed">,
>(
	current: Collections,
	userId: string,
	tasks: ReadonlyArray<T>,
): Promise<Array<T & { isUnderway: boolean }>> {
	const checklistIds = [
		...new Set(
			tasks.flatMap((task) =>
				task.checklistId === null ? [] : [task.checklistId],
			),
		),
	];
	const checklists =
		checklistIds.length === 0
			? []
			: await current.checklists
					.find(
						{ userId, checklistId: { $in: checklistIds } },
						{ projection: { _id: 0, checklistId: 1, stages: 1 } },
					)
					.toArray();
	const byId = new Map(
		checklists.map((checklist) => [checklist.checklistId, checklist]),
	);

	return tasks.map((task) => ({
		...task,
		isUnderway: isUnderway(
			task,
			checklistStages(
				(task.checklistId === null ? undefined : byId.get(task.checklistId)) ??
					{},
			),
		),
	}));
}

/* -------------------------------------------------------------------------- */
/* Special tags                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The colour each special tag starts in. Today takes the gold of the app's
 * bolt, which is the mark that puts a task on it.
 */
const SPECIAL_TAG_COLORS: Record<SpecialTag, TagColor> = {
	today: "yellow",
};

/** Accounts whose special tags this server has already seen to. */
const ensured = new Set<string>();

/** Two first requests raced to make the same special tag; the other won. */
function isDuplicateKey(error: unknown): boolean {
	return error instanceof MongoServerError && error.code === 11000;
}

/**
 * Make sure an account has its special tags, nothing left on the lists they
 * replaced, and no Backlog tag left from before the Backlog was a checklist.
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
	await ensureBacklog(userId);
	ensured.add(userId);
}

/**
 * Today and the Backlog used to be lists of their own, holding references to
 * tasks. They are tags now, so whatever an account still has on them is
 * written onto each task as its tag — into the title, as the bolt would write
 * it — and the references are dropped. The Backlog is a checklist now, so an
 * entry from its list has no tag to go onto and is only dropped. After the
 * first time this finds nothing.
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

export async function listTags(
	userId: string,
	hidden: Hidden,
): Promise<Array<Tag>> {
	await ensureSpecialTags(userId);

	const current = await collections();
	const tags = await current.tags
		.find({ userId }, { projection: DOMAIN_FIELDS })
		.toArray();

	return (
		tags
			// Kept from this person in their team: to them it does not exist.
			.filter((tag) => !hidden.tagIds.has(tag.tagId))
			.map(withSchedule)
			.sort(inOrder)
	);
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
	hidden: Hidden,
): Promise<Array<TagSummary>> {
	const current = await collections();

	const [tags, stored, trackers] = await Promise.all([
		listTags(userId, hidden),
		current.tasks
			.find(
				{ userId },
				{
					projection: {
						_id: 0,
						checklistId: 1,
						tagIds: 1,
						completed: 1,
						trackerId: 1,
						linkedChecklistId: 1,
						stageId: 1,
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
						trackerId: 1,
						tagIds: 1,
						currentValue: 1,
						targetValue: 1,
						startValue: 1,
					},
				},
			)
			.toArray()
			// Only the trackers this person can see.
			.then((found) =>
				found.filter((tracker) => !hidden.trackerIds.has(tracker.trackerId)),
			),
	]);

	// Counted the way a checklist counts, so a task finished by its tracker is
	// done here as well — and only the tasks this person can see.
	const tasks = await withUnderway(
		current,
		userId,
		await withTrackedCompletion(
			current,
			userId,
			stored.filter((task) => isTaskVisible(task, hidden)),
		),
	);

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

	const byTag = new Map<
		string,
		Array<{ completed: boolean; isUnderway?: boolean }>
	>();
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
	hidden: Hidden,
): Promise<Tag> {
	const kind = SPECIAL_TAGS.find((each) => each === tagIdOrKind);
	if (kind !== undefined) await ensureSpecialTags(userId);

	const found = await current.tags.findOne(
		kind === undefined
			? { tagId: tagIdOrKind, userId }
			: { special: kind, userId },
		{ projection: DOMAIN_FIELDS },
	);
	if (!found || hidden.tagIds.has(found.tagId)) {
		throw new AppError("not_found", "That tag no longer exists.");
	}

	return withSchedule(found);
}

/**
 * Every task carrying a tag, from whichever checklist.
 *
 * Each comes with the title of the checklist it lives in, because on a tag's
 * page that is the one thing a row cannot take for granted — and with the
 * stage it is at there filled in, as its checklist's own page would have it.
 * `stagesOf` gives each checklist's stages, for ordering by them.
 */
async function readTagEntries(
	current: Collections,
	userId: string,
	tagId: string,
	hidden: Hidden,
): Promise<{
	entries: Array<TagTaskEntry>;
	stagesOf: (checklistId: string | null) => ReadonlyArray<Stage>;
}> {
	// Anything still in no checklist moves into the Inbox before it is shown.
	await ensureInbox(userId);

	const stored = (
		await current.tasks
			.find({ userId, tagIds: tagId })
			.project<TaskDoc>(DOMAIN_FIELDS)
			.toArray()
	).filter((task) => isTaskVisible(task, hidden));

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
				{ projection: { _id: 0, checklistId: 1, title: 1, stages: 1 } },
			)
			.toArray(),
		// Finished by its tracker counts as finished; see `withTrackedCompletion`.
		withTrackedCompletion(current, userId, stored),
	]);

	const byId = new Map(
		checklists.map((checklist) => [checklist.checklistId, checklist]),
	);
	const stagesOf = (checklistId: string | null) =>
		checklistStages(
			(checklistId === null ? undefined : byId.get(checklistId)) ?? {},
		);

	return {
		entries: tasks.map(({ checklistId, ...task }) => {
			const checklist =
				checklistId === null ? undefined : byId.get(checklistId);
			return {
				task: { ...task, stageId: stageOf(task, stagesOf(checklistId)) },
				checklistId,
				checklistTitle: checklist?.title ?? null,
			};
		}),
		stagesOf,
	};
}

/**
 * One tag: its progress and its trackers — only one person's, in a team, when
 * the screen is showing theirs.
 *
 * Every task carrying it is counted, but none comes back: the open ones are
 * read a page at a time, and the finished ones only once their section is
 * opened; see `getTagOpenTasks` and `getTagCompleted`.
 */
export async function getTag(
	userId: string,
	tagIdOrKind: string,
	hidden: Hidden,
	assignee?: string,
): Promise<TagDetail> {
	const current = await collections();
	const tag = await findTag(current, userId, tagIdOrKind, hidden);
	const { tagId } = tag;

	const trackersRead = current.trackers
		.find({ userId, tagIds: tagId }, { projection: DOMAIN_FIELDS })
		.toArray()
		.then((found) =>
			found.filter(
				(tracker) =>
					!hidden.trackerIds.has(tracker.trackerId) &&
					isAssignedTo(tracker, assignee),
			),
		);

	const [tasks, trackers, readings] = await Promise.all([
		current.tasks
			.find(
				{ userId, tagIds: tagId },
				{
					projection: {
						_id: 0,
						checklistId: 1,
						tagIds: 1,
						completed: 1,
						trackerId: 1,
						linkedChecklistId: 1,
						assignees: 1,
						stageId: 1,
					},
				},
			)
			.toArray()
			// Only what this person can see, and only whose the screen asks for;
			// finished by its tracker counts as finished, see
			// `withTrackedCompletion`, and whether each is under way.
			.then((stored) =>
				withTrackedCompletion(
					current,
					userId,
					stored.filter(
						(task) =>
							isTaskVisible(task, hidden) && isAssignedTo(task, assignee),
					),
				),
			)
			.then((tasks) => withUnderway(current, userId, tasks)),
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
			...tasks,
			// A tracker counts as one more thing to finish, done at its target.
			...trackerEntries.map((entry) => ({
				completed: entry.tracker.progress.percent >= 100,
			})),
		]),
		trackers: trackerEntries,
	};
}

/**
 * A page of the open tasks carrying a tag, in the order its screen shows them.
 * Every one is still read, as for a checklist; see `getChecklistOpenTasks`.
 */
export async function getTagOpenTasks(
	userId: string,
	tagIdOrKind: string,
	view: TaskPageView,
	hidden: Hidden,
): Promise<Page<TagTaskEntry>> {
	const current = await collections();
	const tag = await findTag(current, userId, tagIdOrKind, hidden);

	const { entries, stagesOf } = await readTagEntries(
		current,
		userId,
		tag.tagId,
		hidden,
	);
	// In a team, only one person's when the screen asks for theirs.
	const open = entries.filter(
		(entry) => !entry.task.completed && isAssignedTo(entry.task, view.assignee),
	);

	return pageOf(
		orderByTask(
			open,
			view.sort,
			(entry) => entry.task,
			(entry) => stageProgress(entry.task, stagesOf(entry.checklistId)),
		),
		view,
		(entry) => entry.task.taskId,
	);
}

/**
 * The finished tasks carrying a tag, read once its Completed section is
 * opened. Read whole, as a checklist's are; see `getChecklistCompleted`.
 */
export async function getTagCompleted(
	userId: string,
	tagIdOrKind: string,
	hidden: Hidden,
): Promise<Array<TagTaskEntry>> {
	const current = await collections();
	const tag = await findTag(current, userId, tagIdOrKind, hidden);

	const { entries } = await readTagEntries(current, userId, tag.tagId, hidden);
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
		visibleTo: Array<string> | null;
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
		visibleTo: input.visibleTo,
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
		visibleTo?: Array<string> | null;
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
 * A special tag is refused: the row's bolt writes it, so it has to exist.
 * The tag itself goes last: a tag still listed but stripped from its
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
