import { queryOptions } from "@tanstack/react-query";
import { getBackdropsFn } from "#/functions/preferences.functions";
import { queryKeys } from "./keys";

/** The illustration each page shows this person; see `Backdrops`. */
export const backdropsQuery = () =>
	queryOptions({
		queryKey: queryKeys.backdrops,
		queryFn: () => getBackdropsFn(),
		staleTime: Number.POSITIVE_INFINITY,
	});
