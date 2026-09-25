import { queryOptions } from "@tanstack/react-query";
import { getPlanFn, listPlansFn } from "#/functions/plan.functions";
import { queryKeys } from "./keys";

export const plansQuery = () =>
	queryOptions({
		queryKey: queryKeys.plans,
		queryFn: () => listPlansFn(),
	});

export const planQuery = (planId: string) =>
	queryOptions({
		queryKey: queryKeys.plan(planId),
		queryFn: () => getPlanFn({ data: { planId } }),
	});
