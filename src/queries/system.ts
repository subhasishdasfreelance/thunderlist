import { queryOptions } from "@tanstack/react-query";
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
