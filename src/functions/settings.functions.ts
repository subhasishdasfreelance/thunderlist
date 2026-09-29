import { createServerFn } from "@tanstack/react-start";
import {
	listArrangements,
	listGroups,
	listTaskTypes,
} from "#/data/settings.server";
import { guard } from "./guard";
import { requireScope } from "./scope";

/** The task types of the space this browser is working in. */
export const listTaskTypesFn = createServerFn().handler(() =>
	guard("listTaskTypes", async () =>
		listTaskTypes((await requireScope()).ownerId),
	),
);

/** How the space being worked in orders its lists; see `Arrangement`. */
export const listArrangementsFn = createServerFn().handler(() =>
	guard("listArrangements", async () =>
		listArrangements((await requireScope()).ownerId),
	),
);

/** The groups of the space being worked in; see `Group`. */
export const listGroupsFn = createServerFn().handler(() =>
	guard("listGroups", async () => listGroups((await requireScope()).ownerId)),
);
