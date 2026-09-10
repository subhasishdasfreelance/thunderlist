import type {
	EnsureQueryDataOptions,
	QueryClient,
	QueryKey,
} from "@tanstack/react-query";

/**
 * Warm the query cache from a route loader without holding up navigation, and
 * without letting a failed read take the whole route down.
 *
 * On the server the read is waited for, so the first page arrives with its
 * content already in it. In the browser it is not: waiting there kept the old
 * screen up for a whole round trip after every click, which reads as a click
 * that missed. The new screen renders at once instead, draws its own loading
 * state where the data goes, and fills in when the read lands. Anything the
 * cache already holds is drawn straight away and refreshed behind it.
 *
 * The database can be unreachable, unconfigured, or simply having a bad
 * minute. When that happens the failure stays in the query cache and the route's
 * component renders its error state, so the user still gets the app shell,
 * navigation and a message they can act on instead of a blank 500.
 */
export async function primeQuery<
	TQueryFnData,
	TError,
	TData,
	TQueryKey extends QueryKey,
>(
	queryClient: QueryClient,
	options: EnsureQueryDataOptions<TQueryFnData, TError, TData, TQueryKey>,
): Promise<void> {
	// Deliberately swallowed; the component reads the error from the cache.
	const read = queryClient.ensureQueryData(options).catch(() => {});

	if (typeof window === "undefined") await read;
}

/**
 * Start a read the screen does not have to wait for.
 *
 * A route should block on the one thing the page is *about* and nothing else.
 * Everything secondary — the tag list behind an autocomplete, a history below
 * the fold — is started here and left to arrive on its own, so the part the
 * reader came for paints as soon as it can and the rest fills in behind it with
 * its own small spinner.
 *
 * Failures are swallowed for the same reason as `primeQuery`: the component
 * reads the error out of the cache and decides what to say about it.
 */
export function deferQuery<
	TQueryFnData,
	TError,
	TData,
	TQueryKey extends QueryKey,
>(
	queryClient: QueryClient,
	options: EnsureQueryDataOptions<TQueryFnData, TError, TData, TQueryKey>,
): void {
	void queryClient.ensureQueryData(options).catch(() => {});
}
