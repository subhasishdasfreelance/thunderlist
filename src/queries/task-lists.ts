import { queryOptions } from "@tanstack/react-query";
import { getTaskListsFn } from "#/functions/task-list.functions";
import { queryKeys } from "./keys";

export const taskListsQuery = () =>
	queryOptions({
		queryKey: queryKeys.taskLists,
		queryFn: () => getTaskListsFn(),
	});
