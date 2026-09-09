import { createServerFn } from "@tanstack/react-start";
import { currentUser, type SignedInUser } from "#/lib/auth.server";

/**
 * Who is signed in, for the router to decide where to send them.
 *
 * Deliberately not guarded: an anonymous visitor asking this gets `null`, which
 * is the answer that sends them to the login page. Everything that reads stored
 * data uses `requireUserId` instead and refuses outright.
 *
 * What comes back is only what the interface shows — a name, an email and the
 * Google picture. No token, and no session id.
 */
export const getSessionFn = createServerFn().handler(
	async (): Promise<SignedInUser | null> => currentUser(),
);
