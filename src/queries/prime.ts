import type {
	EnsureQueryDataOptions,
	QueryClient,
	QueryKey,
} from "@tanstack/react-query";

/**
 * Warm the query cache from a route loader without letting a failed read take
 * the whole route down.
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
	try {
		await queryClient.ensureQueryData(options);
	} catch {
		// Deliberately swallowed; the component reads the error from the cache.
	}
}
