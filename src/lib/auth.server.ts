/**
 * The signed-in user, as the server sees it. Server only.
 *
 * This is the single place a user id enters the application. Everything in
 * `src/data` takes one as its first argument and filters every query by it, so
 * the whole question of "can this person see this row" reduces to: is the id
 * they are scoped to the one Better Auth read out of their session cookie, or
 * something they sent us?
 *
 * It is always the former. Nothing here reads an id from a request body, a
 * search param or a header the browser controls.
 */

import { getRequest } from "@tanstack/react-start/server";
import { auth } from "#/lib/auth";
import { AppError } from "#/lib/errors";

export type SignedInUser = {
	userId: string;
	name: string;
	email: string;
	/** The Google profile picture, or `null` if the account has none. */
	image: string | null;
};

/** Whoever is signed in, or `null`. Never throws for an anonymous visitor. */
export async function currentUser(): Promise<SignedInUser | null> {
	const session = await auth.api.getSession({
		headers: getRequest().headers,
	});

	if (!session?.user) return null;

	return {
		userId: session.user.id,
		name: session.user.name,
		email: session.user.email,
		image: session.user.image ?? null,
	};
}

/**
 * The signed-in user, or a refusal.
 *
 * Every server function that touches stored data calls this first and passes
 * the id it returns down into `src/data`. A request without a valid session
 * never reaches a query at all.
 */
async function requireUser(): Promise<SignedInUser> {
	const user = await currentUser();

	if (!user) {
		throw new AppError("unauthorized", "Sign in to see your Thunderlist.");
	}

	return user;
}

/** The id alone, which is all most callers need. */
export async function requireUserId(): Promise<string> {
	return (await requireUser()).userId;
}
