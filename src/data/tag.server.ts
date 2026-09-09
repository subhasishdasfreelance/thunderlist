/**
 * Tags. Server only.
 *
 * Tags are their own collection and tasks reference them by id. That
 * indirection is the whole point: renaming or recolouring a tag is a single
 * document write, however many tasks carry it, and a task can never end up
 * showing a stale copy of a name.
 */

import { AppError } from "#/lib/errors";
import { collections, DOMAIN_FIELDS } from "#/lib/mongo/client.server";
import type { Tag, TagColor } from "#/schemas/tag";
import { removeTagFromTasks } from "./checklist.server";

function byName(a: Tag, b: Tag): number {
	return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export async function listTags(): Promise<Array<Tag>> {
	const current = await collections();
	const tags = await current.tags
		.find({}, { projection: DOMAIN_FIELDS })
		.toArray();

	return tags.sort(byName);
}

/**
 * Names are compared case-insensitively so "Urgent" and "urgent" cannot both
 * exist: two tags that look identical in a list are indistinguishable to the
 * person picking one.
 */
async function assertNameIsFree(
	name: string,
	exceptTagId?: string,
): Promise<void> {
	const current = await collections();
	const taken = await current.tags.findOne({
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

export async function createTag(input: {
	tagId: string;
	name: string;
	color: TagColor;
}): Promise<Tag> {
	const current = await collections();

	// Queuing the same new tag twice, or applying a batch a second time, should
	// settle rather than fail.
	const existing = await current.tags.findOne(
		{ tagId: input.tagId },
		{ projection: DOMAIN_FIELDS },
	);
	if (existing) return existing;

	await assertNameIsFree(input.name);

	const now = new Date().toISOString();
	// Listed field by field rather than spread: the caller passes the whole
	// queued change, and spreading it would store its `kind` alongside.
	const tag: Tag = {
		tagId: input.tagId,
		name: input.name,
		color: input.color,
		createdAt: now,
		updatedAt: now,
	};

	await current.tags.insertOne(tag);

	return tag;
}

export async function updateTag(
	tagId: string,
	patch: { name?: string; color?: TagColor },
): Promise<Tag> {
	if (patch.name !== undefined) await assertNameIsFree(patch.name, tagId);

	const current = await collections();
	const next = await current.tags.findOneAndUpdate(
		{ tagId },
		{ $set: { ...patch, updatedAt: new Date().toISOString() } },
		{ returnDocument: "after", projection: DOMAIN_FIELDS },
	);

	if (!next) throw new AppError("not_found", "That tag no longer exists.");

	return next;
}

/**
 * Delete a tag and take it off every task carrying it.
 *
 * The tag itself goes last: a tag still listed but stripped from its tasks is
 * recoverable by re-applying it, whereas tasks left pointing at a tag that no
 * longer exists would render as nothing at all.
 */
export async function deleteTag(tagId: string): Promise<void> {
	const current = await collections();

	await removeTagFromTasks(tagId);
	// Already gone is the outcome this asked for, not a failure.
	await current.tags.deleteOne({ tagId });
}
