import { createServerFn } from "@tanstack/react-start";
import { listTaskTypes } from "#/data/settings.server";
import { guard } from "./guard";
import { requireScope } from "./scope";

/** The task types of the space this browser is working in. */
export const listTaskTypesFn = createServerFn().handler(() =>
	guard("listTaskTypes", async () =>
		listTaskTypes((await requireScope()).ownerId),
	),
);
