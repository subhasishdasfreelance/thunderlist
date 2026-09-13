import { useQuery } from "@tanstack/react-query";
import { taskTypesQuery } from "#/queries/space";
import type { TaskType } from "#/schemas/task-type";

/**
 * The task types of the space being worked in — empty until they have loaded,
 * so a row draws no type rather than a wrong one.
 */
export function useTaskTypes(): ReadonlyArray<TaskType> {
	return useQuery(taskTypesQuery()).data ?? [];
}
