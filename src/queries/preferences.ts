import { queryOptions } from "@tanstack/react-query";
import {
	getBackdropsFn,
	getColorSchemeFn,
} from "#/functions/preferences.functions";
import { queryKeys } from "./keys";

/** The illustration each page shows this person; see `Backdrops`. */
export const backdropsQuery = () =>
	queryOptions({
		queryKey: queryKeys.backdrops,
		queryFn: () => getBackdropsFn(),
		staleTime: Number.POSITIVE_INFINITY,
	});

/**
 * This person's light or dark, as kept on the account. Fetched again on
 * coming back to the app, so a change made on another device arrives here
 * too; see `useAccountColorScheme`. Not polled: it changes rarely.
 */
export const colorSchemeQuery = () =>
	queryOptions({
		queryKey: queryKeys.colorScheme,
		queryFn: () => getColorSchemeFn(),
		refetchInterval: false,
	});
