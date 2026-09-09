import { createServerFn } from "@tanstack/react-start";
import { getTaskLists } from "#/data/task-list.server";
import { requireUserId } from "#/lib/auth.server";
import { guard } from "./guard";

/**
 * Today and Backlog in one call. They resolve against the same checklists, so
 * fetching them together costs one batched task read instead of two.
 */
export const getTaskListsFn = createServerFn().handler(() =>
	guard("getTaskLists", async () => getTaskLists(await requireUserId())),
);
