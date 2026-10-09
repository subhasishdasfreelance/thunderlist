/**
 * What one person has chosen for themself: how each page of the app is
 * drawn behind it, and light or dark. Server only.
 *
 * One document per account, absent until something is picked, so a person
 * who never picked reads the defaults and nothing is written for them.
 */

import { collections } from "#/lib/mongo/client.server";
import type { ColorScheme } from "#/lib/theme";
import type { Backdrops, SetBackdropInput } from "#/schemas/backdrop";

export async function getBackdrops(userId: string): Promise<Backdrops> {
	const current = await collections();
	const preferences = await current.preferences.findOne(
		{ userId },
		{ projection: { _id: 0, backdrops: 1 } },
	);

	return preferences?.backdrops ?? {};
}

/** One page's design and colours; the others are left as they are. */
export async function setBackdrop(
	userId: string,
	{ page, design, palette }: SetBackdropInput,
): Promise<void> {
	const current = await collections();

	await current.preferences.updateOne(
		{ userId },
		{
			$set: {
				[`backdrops.${page}`]: { design, palette },
				updatedAt: new Date().toISOString(),
			},
		},
		{ upsert: true },
	);
}

/** Their light or dark, or `null` if it was never kept on the account. */
export async function getColorScheme(
	userId: string,
): Promise<ColorScheme | null> {
	const current = await collections();
	const preferences = await current.preferences.findOne(
		{ userId },
		{ projection: { _id: 0, colorScheme: 1 } },
	);

	return preferences?.colorScheme ?? null;
}

export async function setColorScheme(
	userId: string,
	colorScheme: ColorScheme,
): Promise<void> {
	const current = await collections();

	await current.preferences.updateOne(
		{ userId },
		{ $set: { colorScheme, updatedAt: new Date().toISOString() } },
		{ upsert: true },
	);
}
