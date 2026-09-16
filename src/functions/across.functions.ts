import { createServerFn } from "@tanstack/react-start";
import { getAcrossTasks } from "#/data/across.server";
import { acrossPageSchema } from "#/schemas/task";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";
import { requireScope } from "./scope";

/**
 * One group of the Across lists screen, a page at a time, with the counts for
 * its tabs. Nothing is named to check access against: it spans every checklist
 * this person can see, and `scope.hidden` is what decides which those are.
 */
export const getAcrossTasksFn = createServerFn()
	.validator(validator(acrossPageSchema))
	.handler(({ data }) =>
		guard("getAcrossTasks", async () => {
			const scope = await requireScope();
			return getAcrossTasks(scope.ownerId, data, scope.hidden);
		}),
	);
