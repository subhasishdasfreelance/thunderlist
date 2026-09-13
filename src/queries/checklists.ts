import { queryOptions } from "@tanstack/react-query";
import {
	getChecklistCompletedFn,
	getChecklistFn,
	getChecklistStageTasksFn,
	listChecklistsFn,
} from "#/functions/checklist.functions";
import type { TaskFilter, TaskPageView } from "#/schemas/task";
import { queryKeys } from "./keys";

export const checklistsQuery = () =>
	queryOptions({
		queryKey: queryKeys.checklists,
		queryFn: () => listChecklistsFn(),
	});

export const checklistQuery = (checklistId: string) =>
	queryOptions({
		queryKey: queryKeys.checklist(checklistId),
		queryFn: () => getChecklistFn({ data: { checklistId } }),
		/*
		 * "That checklist no longer exists" is an answer, not a hiccup. A
		 * checklist that lives only in the unsaved queue answers that way every
		 * time, and retrying it three times just delays the screen the browser
		 * could already draw.
		 */
		retry: false,
	});

/** The figures, counting only what a filter lets through. */
export const checklistFilteredQuery = (
	checklistId: string,
	filter: TaskFilter,
) =>
	queryOptions({
		queryKey: queryKeys.checklistFiltered(checklistId, filter),
		queryFn: () => getChecklistFn({ data: { checklistId, ...filter } }),
		retry: false,
	});

/** One page of one stage; see `getChecklistStageTasks`. */
export const checklistPageQuery = (checklistId: string, view: TaskPageView) =>
	queryOptions({
		queryKey: queryKeys.checklistPage(checklistId, view),
		queryFn: () => getChecklistStageTasksFn({ data: { checklistId, ...view } }),
		retry: false,
	});

/** The finished tasks, which the screen asks for once they are opened. */
export const checklistCompletedQuery = (checklistId: string) =>
	queryOptions({
		queryKey: queryKeys.checklistCompleted(checklistId),
		queryFn: () => getChecklistCompletedFn({ data: { checklistId } }),
		retry: false,
	});
