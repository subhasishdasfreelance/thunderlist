import { createServerFn } from "@tanstack/react-start";
import { getPlan, listPlans } from "#/data/plan.server";
import { assertLevel } from "#/data/visibility.server";
import { planIdInputSchema } from "#/schemas/plan";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";
import { requireScope } from "./scope";

/** Every plan in the space they can see, without bodies; see `PlanSummary`. */
export const listPlansFn = createServerFn().handler(() =>
	guard("listPlans", async () => {
		const scope = await requireScope();
		return listPlans(scope.ownerId, scope.hidden);
	}),
);

export const getPlanFn = createServerFn()
	.validator(validator(planIdInputSchema))
	.handler(({ data }) =>
		guard("getPlan", async () => {
			const scope = await requireScope();
			assertLevel(scope, "plans", data.planId, "read");
			return getPlan(scope.ownerId, data.planId);
		}),
	);
