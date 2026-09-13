/**
 * What a space chooses for itself: its task types. Server only.
 *
 * One document per owner, absent until something is changed — so a space that
 * never touched its types reads the defaults, and nothing is written for it.
 */

import { collections } from "#/lib/mongo/client.server";
import { DEFAULT_TASK_TYPES, type TaskType } from "#/schemas/task-type";

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
