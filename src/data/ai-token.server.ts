/**
 * AI access tokens. Server only; see `AiToken`.
 *
 * A token is its person's, whichever space they are in when they list them.
 * Only its hash is stored and looked up, so what is in the database cannot be
 * used to get in.
 */

import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import type { SignedInUser } from "#/lib/auth.server";
import { collections } from "#/lib/mongo/client.server";
import type { AiToken, CreateAiTokenInput } from "#/schemas/ai-token";

function hashOf(secret: string): string {
	return createHash("sha256").update(secret).digest("hex");
}

/** This person's tokens, newest first, each with the space it works in. */
export async function listAiTokens(userId: string): Promise<Array<AiToken>> {
	const current = await collections();
	const tokens = await current.aiTokens
		.find({ userId }, { projection: { _id: 0, tokenHash: 0, userId: 0 } })
		.sort({ createdAt: -1 })
		.toArray();

	const teamIds = [...new Set(tokens.flatMap((token) => token.teamId ?? []))];
	const teams =
		teamIds.length === 0
			? []
			: await current.teams.find({ teamId: { $in: teamIds } }).toArray();

	return tokens.map(({ teamId, ...token }) => {
		const team = teams.find((each) => each.teamId === teamId);
		return {
			...token,
			// A team since deleted is no longer anywhere to work.
			space:
				team === undefined ? null : { teamId: team.teamId, name: team.name },
		};
	});
}

/** Make a token, once however often it is sent, in the space being worked in. */
export async function createAiToken(
	userId: string,
	teamId: string | null,
	input: CreateAiTokenInput,
): Promise<void> {
	const current = await collections();
	await current.aiTokens.updateOne(
		{ tokenId: input.tokenId, userId },
		{
			$setOnInsert: {
				tokenHash: hashOf(input.secret),
				hint: input.secret.slice(-4),
				label: input.label,
				teamId,
				createdAt: new Date().toISOString(),
				lastUsedAt: null,
			},
		},
		{ upsert: true },
	);
}

export async function deleteAiToken(
	userId: string,
	tokenId: string,
): Promise<void> {
	const current = await collections();
	await current.aiTokens.deleteOne({ tokenId, userId });
}

/**
 * Who a token acts as, and the space it works in — or `null` for a token
 * that does not exist, or whose person no longer does. Notes the use.
 */
export async function personForAiToken(secret: string): Promise<{
	tokenId: string;
	person: SignedInUser;
	teamId: string | null;
} | null> {
	const current = await collections();
	const token = await current.aiTokens.findOneAndUpdate(
		{ tokenHash: hashOf(secret) },
		{ $set: { lastUsedAt: new Date().toISOString() } },
		{ projection: { _id: 0, tokenId: 1, userId: 1, teamId: 1 } },
	);
	if (token === null || !ObjectId.isValid(token.userId)) return null;

	// Read afresh each time: the address is what a team knows them by.
	const user = await current.users.findOne({
		_id: new ObjectId(token.userId),
	});
	if (user === null) return null;

	return {
		tokenId: token.tokenId,
		teamId: token.teamId,
		person: {
			userId: token.userId,
			name: user.name,
			email: user.email,
			image: user.image ?? null,
		},
	};
}

/** The space a token works in from its next use; see `switch_space`. */
export async function setAiTokenSpace(
	tokenId: string,
	teamId: string | null,
): Promise<void> {
	const current = await collections();
	await current.aiTokens.updateOne({ tokenId }, { $set: { teamId } });
}
