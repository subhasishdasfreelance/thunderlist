import { getCookie } from "@tanstack/react-start/server";
import { resolveScope, type Scope } from "#/data/team.server";
import { requireUser } from "#/lib/auth.server";

/** Names the team this browser is working in; absent for your own space. */
export const SPACE_COOKIE = "thunderlist-space";

/**
 * Where this request is working, and what it may see there.
 *
 * The team comes from a cookie the browser holds, but it is only ever a
 * request: membership is checked here, on every call, against the signed-in
 * address. A cookie naming a team this person is not in is ignored, and they
 * work in their own space.
 */
export async function requireScope(): Promise<Scope> {
	return resolveScope(await requireUser(), getCookie(SPACE_COOKIE));
}
