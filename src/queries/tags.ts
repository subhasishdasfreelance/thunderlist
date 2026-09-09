import { queryOptions } from "@tanstack/react-query";
import { listTagsFn } from "#/functions/tag.functions";
import { queryKeys } from "./keys";

export const tagsQuery = () =>
	queryOptions({
		queryKey: queryKeys.tags,
		queryFn: () => listTagsFn(),
	});
