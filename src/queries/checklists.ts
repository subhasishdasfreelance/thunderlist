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
		/*
		 * "That checklist no longer exists" is an answer, not a hiccup, so it is
		 * not tried again; see `isTransient`. A checklist that lives only in the
		 * unsaved queue answers that way every time, and retrying it just delays
		 * the screen the browser could already draw.
		 */
		queryFn: () => getChecklistFn({ data: { checklistId } }),
	});

/** The figures, counting only what a filter lets through. */
export const checklistFilteredQuery = (
	checklistId: string,
	filter: TaskFilter,
) =>
	queryOptions({
		queryKey: queryKeys.checklistFiltered(checklistId, filter),
		queryFn: () => getChecklistFn({ data: { checklistId, ...filter } }),
	});

/** One page of one stage; see `getChecklistStageTasks`. */
export const checklistPageQuery = (checklistId: string, view: TaskPageView) =>
	queryOptions({
		queryKey: queryKeys.checklistPage(checklistId, view),
		queryFn: () => getChecklistStageTasksFn({ data: { checklistId, ...view } }),
	});

/** The finished tasks, which the screen asks for once they are opened. */
export const checklistCompletedQuery = (checklistId: string) =>
	queryOptions({
		queryKey: queryKeys.checklistCompleted(checklistId),
		queryFn: () => getChecklistCompletedFn({ data: { checklistId } }),
	});
