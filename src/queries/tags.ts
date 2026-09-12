import { queryOptions } from "@tanstack/react-query";
import {
	getTagCompletedFn,
	getTagFn,
	getTagOpenTasksFn,
	listTagSummariesFn,
	listTagsFn,
} from "#/functions/tag.functions";
import type { TaskPageView } from "#/schemas/task";
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

/** One page of the open tasks carrying a tag; see `getTagOpenTasks`. */
export const tagOpenQuery = (tagId: string, view: TaskPageView) =>
	queryOptions({
		queryKey: queryKeys.tagOpenPage(tagId, view),
		queryFn: () => getTagOpenTasksFn({ data: { tagId, ...view } }),
		retry: false,
	});

/** The finished tasks, which the screen asks for once they are opened. */
export const tagCompletedQuery = (tagId: string) =>
	queryOptions({
		queryKey: queryKeys.tagCompleted(tagId),
		queryFn: () => getTagCompletedFn({ data: { tagId } }),
		retry: false,
	});
