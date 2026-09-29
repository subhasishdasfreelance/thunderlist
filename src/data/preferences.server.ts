/**
 * What one person has chosen for themself: how each part of the app is
 * drawn behind its screens. Server only.
 *
 * One document per account, absent until something is picked, so a person
 * who never picked reads the defaults and nothing is written for them.
 */

import { collections } from "#/lib/mongo/client.server";
import type { Backdrops, SetBackdropInput } from "#/schemas/backdrop";

export async function getBackdrops(userId: string): Promise<Backdrops> {
	const current = await collections();
	const preferences = await current.preferences.findOne(
		{ userId },
		{ projection: { _id: 0, backdrops: 1 } },
	);

	return preferences?.backdrops ?? {};
}

/** One section's design and colours; the others are left as they are. */
export async function setBackdrop(
	userId: string,
	{ section, design, palette }: SetBackdropInput,
): Promise<void> {
	const current = await collections();

	await current.preferences.updateOne(
		{ userId },
		{
			$set: {
				[`backdrops.${section}`]: { design, palette },
				updatedAt: new Date().toISOString(),
			},
		},
		{ upsert: true },
	);
}
