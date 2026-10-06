import { createServerFn } from "@tanstack/react-start";
import { getGroupFinished } from "#/data/group.server";
import {
	listArrangements,
	listGroups,
	listTaskTypes,
} from "#/data/settings.server";
import { assertLevel } from "#/data/visibility.server";
import { groupIdInputSchema } from "#/schemas/group";
import { validator } from "#/schemas/validate";
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

/** The groups of the space being worked in that they can see; see `Group`. */
export const listGroupsFn = createServerFn().handler(() =>
	guard("listGroups", async () => {
		const scope = await requireScope();
		return (await listGroups(scope.ownerId)).filter(
			(group) => !scope.hidden.groupIds.has(group.groupId),
		);
	}),
);

/** When everything a group counts was finished, for its chart. */
export const getGroupFinishedFn = createServerFn()
	.validator(validator(groupIdInputSchema))
	.handler(({ data }) =>
		guard("getGroupFinished", async () => {
			const scope = await requireScope();
			assertLevel(scope, "groups", data.groupId, "read");
			return getGroupFinished(scope.ownerId, data.groupId, scope.hidden);
		}),
	);
