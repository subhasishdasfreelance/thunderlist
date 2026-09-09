import { queryOptions } from "@tanstack/react-query";
import type { SearchIndex } from "#/data/search.server";
import {
	getSearchIndexFn,
	getSetupStatusFn,
} from "#/functions/system.functions";
import { queryKeys } from "./keys";

export const setupStatusQuery = () =>
	queryOptions({
		queryKey: queryKeys.setupStatus,
		queryFn: () => getSetupStatusFn(),
	});

export const searchIndexQuery = () =>
	queryOptions({
		queryKey: queryKeys.searchIndex,
		queryFn: () => getSearchIndexFn(),
	});

/** One task as the search index carries it: what it is and where it lives. */
export type TaggedTask = SearchIndex["tasks"][number];
