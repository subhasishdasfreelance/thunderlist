/**
 * Countdowns: days counted down to. Server only.
 *
 * Every operation is idempotent, as everywhere: making a countdown that
 * already exists returns it, deleting one already gone is a no-op.
 */

import { AppError } from "#/lib/errors";
import { collections, DOMAIN_FIELDS } from "#/lib/mongo/client.server";
import type { Countdown, CountdownFormat } from "#/schemas/countdown";
import type { TagColor } from "#/schemas/tag";
import { nextNumber } from "./numbers.server";

/** Every countdown, by the day each counts down to. */
export async function listCountdowns(
	userId: string,
): Promise<Array<Countdown>> {
	const current = await collections();
	return current.countdowns
		.find({ userId }, { projection: DOMAIN_FIELDS, sort: { date: 1 } })
		.toArray();
}

export async function createCountdown(
	userId: string,
	input: {
		countdownId: string;
		title: string;
		date: string;
		color: TagColor;
		format: CountdownFormat;
	},
): Promise<Countdown> {
	const current = await collections();

	const existing = await current.countdowns.findOne(
		{ countdownId: input.countdownId, userId },
		{ projection: DOMAIN_FIELDS },
	);
	if (existing) return existing;

	const now = new Date().toISOString();
	// Field by field, so the change's `kind` is not stored alongside.
	const countdown: Countdown = {
		countdownId: input.countdownId,
		number: await nextNumber(current, userId, "countdown"),
		title: input.title,
		date: input.date,
		color: input.color,
		format: input.format,
		createdAt: now,
		updatedAt: now,
	};

	await current.countdowns.insertOne({ ...countdown, userId });
	return countdown;
}

export async function updateCountdown(
	userId: string,
	countdownId: string,
	patch: {
		title?: string;
		date?: string;
		color?: TagColor;
		format?: CountdownFormat;
	},
): Promise<void> {
	const current = await collections();

	const result = await current.countdowns.updateOne(
		{ countdownId, userId },
		{ $set: { ...patch, updatedAt: new Date().toISOString() } },
	);

	if (result.matchedCount === 0) {
		throw new AppError("not_found", "That countdown no longer exists.");
	}
}

export async function deleteCountdown(
	userId: string,
	countdownId: string,
): Promise<void> {
	const current = await collections();
	await current.countdowns.deleteOne({ countdownId, userId });
}
