import { queryOptions } from "@tanstack/react-query";
import { listCountdownsFn } from "#/functions/countdown.functions";
import { queryKeys } from "./keys";

export const countdownsQuery = () =>
	queryOptions({
		queryKey: queryKeys.countdowns,
		queryFn: () => listCountdownsFn(),
	});
