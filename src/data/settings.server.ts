/**
 * What a space chooses for itself: its task types, how its lists are ordered,
 * and its groups. Server only.
 *
 * One document per owner, absent until something is changed — so a space that
 * never touched its types reads the defaults, and nothing is written for it.
 */

import { collections } from "#/lib/mongo/client.server";
import type {
	ArrangedList,
	Arrangement,
	Arrangements,
} from "#/schemas/arrangement";
import type { Group, GroupItem, GroupItemKind } from "#/schemas/group";
import { TAG_COLORS } from "#/schemas/tag";
import { DEFAULT_TASK_TYPES, type TaskType } from "#/schemas/task-type";
import { nextNumber } from "./numbers.server";

export async function listTaskTypes(userId: string): Promise<Array<TaskType>> {
	const current = await collections();
	const settings = await current.settings.findOne(
		{ userId },
		{ projection: { _id: 0, taskTypes: 1 } },
	);

	return settings?.taskTypes ?? [...DEFAULT_TASK_TYPES];
}

/**
 * Replace a space's whole list of types.
 *
 * A type taken off the list comes off every task carrying it too, so no task
 * is left naming a type nobody can see or pick again.
 */
export async function setTaskTypes(
	userId: string,
	types: Array<TaskType>,
): Promise<void> {
	const current = await collections();

	await current.settings.updateOne(
		{ userId },
		{ $set: { taskTypes: types, updatedAt: new Date().toISOString() } },
		{ upsert: true },
	);

	await current.tasks.updateMany(
		{
			userId,
			typeId: { $nin: [...types.map((type) => type.typeId), null] },
		},
		{ $set: { typeId: null } },
	);
}

/** How the space orders its lists; see `Arrangement`. Nothing for none. */
export async function listArrangements(userId: string): Promise<Arrangements> {
	const current = await collections();
	const settings = await current.settings.findOne(
		{ userId },
		{ projection: { _id: 0, arrangements: 1 } },
	);

	return settings?.arrangements ?? {};
}

/**
 * Replace one list's order. Only the order is written: anything else kept
 * under the list — its groups from before — is left for `listGroups` to read.
 */
export async function setArrangement(
	userId: string,
	list: ArrangedList,
	arrangement: Arrangement,
): Promise<void> {
	const current = await collections();

	await current.settings.updateOne(
		{ userId },
		{
			$set: {
				[`arrangements.${list}.order`]: arrangement.order,
				updatedAt: new Date().toISOString(),
			},
		},
		{ upsert: true },
	);
}

/** The lists that once kept groups of their own; plans never did. */
const KIND_OF_LIST: Record<"checklists" | "trackers" | "tags", GroupItemKind> =
	{
		checklists: "checklist",
		trackers: "tracker",
		tags: "tag",
	};

/**
 * The space's groups.
 *
 * The first read writes them: groups used to belong to one list each, and those
 * become groups here — a list's "Work" and another's "Work" one group holding
 * both — so nothing arranged before is lost. After that the old ones are never
 * read again.
 */
export async function listGroups(userId: string): Promise<Array<Group>> {
	const current = await collections();
	const settings = await current.settings.findOne(
		{ userId },
		{ projection: { _id: 0, groups: 1, arrangements: 1 } },
	);
	if (settings?.groups !== undefined) return settings.groups;

	const now = new Date().toISOString();
	const byName = new Map<string, Group>();
	for (const [list, arrangement] of Object.entries(
		settings?.arrangements ?? {},
	)) {
		const kind = KIND_OF_LIST[list as keyof typeof KIND_OF_LIST];
		for (const old of arrangement?.groups ?? []) {
			const key = old.name.toLowerCase();
			const group = byName.get(key) ?? {
				groupId: old.groupId,
				name: old.name,
				color: TAG_COLORS[byName.size % TAG_COLORS.length],
				items: [],
				createdAt: now,
				updatedAt: now,
			};
			const items: Array<GroupItem> = old.itemIds.map((id) => ({ kind, id }));
			group.items.push(...items);
			byName.set(key, group);
		}
	}
	const groups = [...byName.values()];
	for (const group of groups) {
		group.number = await nextNumber(current, userId, "group");
	}

	// Only where none have been written yet, so two first reads agree. Two
	// first reads of a space with no settings at all can both try to make the
	// document; the one that loses finds it made, which is the same outcome.
	try {
		await current.settings.updateOne(
			{ userId, groups: { $exists: false } },
			{ $set: { groups } },
			{ upsert: settings === null },
		);
	} catch (error) {
		if ((error as { code?: number }).code !== 11000) throw error;
	}
	return groups;
}

/** Add a group. Already there is the outcome this asked for. */
export async function createGroup(
	userId: string,
	input: Omit<Group, "createdAt" | "updatedAt">,
): Promise<void> {
	const current = await collections();
	await listGroups(userId);

	const now = new Date().toISOString();
	await current.settings.updateOne(
		{ userId, "groups.groupId": { $ne: input.groupId } },
		{
			$push: {
				groups: {
					groupId: input.groupId,
					number: await nextNumber(current, userId, "group"),
					name: input.name,
					color: input.color,
					items: input.items,
					startDate: input.startDate,
					deadline: input.deadline ?? null,
					deadlineTime: input.deadlineTime ?? null,
					createdAt: now,
					updatedAt: now,
				},
			},
		},
	);
}

/** Rename, recolour or refill a group. Gone already is not a failure. */
export async function updateGroup(
	userId: string,
	groupId: string,
	patch: Partial<
		Pick<
			Group,
			"name" | "color" | "items" | "startDate" | "deadline" | "deadlineTime"
		>
	>,
): Promise<void> {
	const current = await collections();
	await listGroups(userId);

	await current.settings.updateOne(
		{ userId, "groups.groupId": groupId },
		{
			$set: {
				...Object.fromEntries(
					Object.entries(patch).map(([field, value]) => [
						`groups.$.${field}`,
						value,
					]),
				),
				"groups.$.updatedAt": new Date().toISOString(),
			},
		},
	);
}

/** Delete a group. What was in it stays, in no group. */
export async function deleteGroup(
	userId: string,
	groupId: string,
): Promise<void> {
	const current = await collections();
	await listGroups(userId);

	await current.settings.updateOne(
		{ userId },
		{ $pull: { groups: { groupId } } },
	);
}
