import { createServerFn } from "@tanstack/react-start";
import { getPlan, listPlans } from "#/data/plan.server";
import { planIdInputSchema } from "#/schemas/plan";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";
import { requireScope } from "./scope";

/** Every plan in the space, without their bodies; see `PlanSummary`. */
export const listPlansFn = createServerFn().handler(() =>
	guard("listPlans", async () => listPlans((await requireScope()).ownerId)),
);

export const getPlanFn = createServerFn()
	.validator(validator(planIdInputSchema))
	.handler(({ data }) =>
		guard("getPlan", async () =>
			getPlan((await requireScope()).ownerId, data.planId),
		),
	);
