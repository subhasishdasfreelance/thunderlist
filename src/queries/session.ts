import { queryOptions } from "@tanstack/react-query";
import { getSessionFn } from "#/functions/session.functions";
import { queryKeys } from "./keys";

/**
 * Who is signed in, for the root guard; see `__root.tsx`.
 *
 * Kept for the life of the page rather than the default five minutes. Nothing
 * renders from it, so no observer keeps it alive, and a guard whose answer had
 * been dropped would make the next click wait for a fresh one.
 */
export const sessionQuery = () =>
	queryOptions({
		queryKey: queryKeys.session,
		queryFn: () => getSessionFn(),
		// How old the answer gets before the guard re-checks it in the background.
		staleTime: 60_000,
		gcTime: Infinity,
	});
