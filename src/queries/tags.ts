import { queryOptions } from "@tanstack/react-query";
import {
	getTagFn,
	listTagSummariesFn,
	listTagsFn,
} from "#/functions/tag.functions";
import { queryKeys } from "./keys";

export const tagsQuery = () =>
	queryOptions({
		queryKey: queryKeys.tags,
		queryFn: () => listTagsFn(),
	});

export const tagSummariesQuery = () =>
	queryOptions({
		queryKey: queryKeys.tagSummaries,
		queryFn: () => listTagSummariesFn(),
	});

export const tagQuery = (tagId: string) =>
	queryOptions({
		queryKey: queryKeys.tag(tagId),
		queryFn: () => getTagFn({ data: { tagId } }),
		// "That tag no longer exists" is an answer, not a hiccup; see
		// `checklistQuery`.
		retry: false,
	});
