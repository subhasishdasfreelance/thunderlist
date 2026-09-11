import { queryOptions } from "@tanstack/react-query";
import {
	getChecklistCompletedFn,
	getChecklistFn,
	listChecklistsFn,
} from "#/functions/checklist.functions";
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

/** The finished tasks, which the screen asks for once it has settled. */
export const checklistCompletedQuery = (checklistId: string) =>
	queryOptions({
		queryKey: queryKeys.checklistCompleted(checklistId),
		queryFn: () => getChecklistCompletedFn({ data: { checklistId } }),
		retry: false,
	});
