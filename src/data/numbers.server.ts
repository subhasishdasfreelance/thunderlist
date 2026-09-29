/**
 * Handing out the numbers people call things by — T-42, C-3; see
 * `NUMBER_PREFIXES`. Server only.
 *
 * Each space keeps one counter per kind, and every new thing takes the next
 * from it. Taking one is a single atomic increment, so two things made at the
 * same moment — by two people in a team, or two tabs — never share a number.
 * A number taken for something that then fails to be written is simply never
 * used; a gap is harmless, a repeat would not be.
 */

import type { Collection, ObjectId } from "mongodb";
import type { Collections } from "#/lib/mongo/client.server";
import { NUMBERED_KINDS, type NumberedKind } from "#/schemas/number";

/** The spaces this server has already made sure are numbered throughout. */
const numbered = new Set<string>();

/** The next number of one kind in a space. */
export async function nextNumber(
	current: Collections,
	userId: string,
	kind: NumberedKind,
): Promise<number> {
	await ensureNumbered(current, userId);
	return (await reserve(current, userId, kind, 1)) + 1;
}

/**
 * Take `count` numbers at once. Answers the last number handed out before
 * them, so the first is one more than it.
 */
async function reserve(
	current: Collections,
	userId: string,
	kind: NumberedKind,
	count: number,
): Promise<number> {
	const counter = await current.counters.findOneAndUpdate(
		{ userId, kind },
		{ $inc: { last: count } },
		{ upsert: true, returnDocument: "after" },
	);
	return (counter?.last ?? count) - count;
}

/**
 * Number everything in a space that has no number yet, oldest first: what
 * was made before there were numbers, and anything a slip left without one.
 *
 * Done once per space for the life of this server, before its first number is
 * handed out or its first read answered; see `requireScope`. It is safe to do
 * twice at once — each write only lands on something still unnumbered — and
 * the worst a race costs is a few numbers skipped.
 */
export async function ensureNumbered(
	current: Collections,
	userId: string,
): Promise<void> {
	if (numbered.has(userId)) return;

	await Promise.all(
		NUMBERED_KINDS.map((kind) =>
			kind === "group"
				? numberGroups(current, userId)
				: numberDocuments(current, userId, kind),
		),
	);
	numbered.add(userId);
}

async function numberDocuments(
	current: Collections,
	userId: string,
	kind: Exclude<NumberedKind, "group">,
): Promise<void> {
	const collection = collectionFor(current, kind);
	// `_id` is the order they were written in, which is the order they were
	// made; a task's own stamps move when it does.
	const unnumbered = await collection
		.find({ userId, number: { $exists: false } }, { projection: { _id: 1 } })
		.sort({ _id: 1 })
		.toArray();
	if (unnumbered.length === 0) return;

	const before = await reserve(current, userId, kind, unnumbered.length);
	await collection.bulkWrite(
		unnumbered.map((each, index) => ({
			updateOne: {
				filter: { _id: each._id, number: { $exists: false } },
				update: { $set: { number: before + index + 1 } },
			},
		})),
	);
}

/** Groups live in the space's settings, in the order they were made. */
async function numberGroups(
	current: Collections,
	userId: string,
): Promise<void> {
	const settings = await current.settings.findOne(
		{ userId },
		{ projection: { _id: 0, groups: 1 } },
	);
	const unnumbered = (settings?.groups ?? []).filter(
		(group) => group.number === undefined,
	);
	if (unnumbered.length === 0) return;

	const before = await reserve(current, userId, "group", unnumbered.length);
	await current.settings.updateOne(
		{ userId },
		{
			$set: Object.fromEntries(
				unnumbered.map((_, index) => [
					`groups.$[g${index}].number`,
					before + index + 1,
				]),
			),
		},
		{
			arrayFilters: unnumbered.map((group, index) => ({
				[`g${index}.groupId`]: group.groupId,
				[`g${index}.number`]: { $exists: false },
			})),
		},
	);
}

type NumberedDocument = { _id: ObjectId; userId: string; number?: number };

/**
 * The collection one kind is kept in, seen only as far as numbering needs:
 * whose it is, and its number.
 */
function collectionFor(
	current: Collections,
	kind: Exclude<NumberedKind, "group">,
) {
	const collection = {
		task: current.tasks,
		checklist: current.checklists,
		tracker: current.trackers,
		tag: current.tags,
		entry: current.entries,
		plan: current.plans,
		countdown: current.countdowns,
	}[kind];
	return collection as unknown as Collection<NumberedDocument>;
}
