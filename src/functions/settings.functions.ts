import { createServerFn } from "@tanstack/react-start";
import { listArrangements, listTaskTypes } from "#/data/settings.server";
import { guard } from "./guard";
import { requireScope } from "./scope";

/** The task types of the space this browser is working in. */
export const listTaskTypesFn = createServerFn().handler(() =>
	guard("listTaskTypes", async () =>
		listTaskTypes((await requireScope()).ownerId),
	),
);

/** How the space being worked in lays out its lists; see `Arrangement`. */
export const listArrangementsFn = createServerFn().handler(() =>
	guard("listArrangements", async () =>
		listArrangements((await requireScope()).ownerId),
	),
);
