import { queryOptions } from "@tanstack/react-query";
import { listAiTokensFn } from "#/functions/ai.functions";
import { queryKeys } from "./keys";

/** Your AI access tokens; see `AiToken`. */
export const aiTokensQuery = () =>
	queryOptions({
		queryKey: queryKeys.aiTokens,
		queryFn: () => listAiTokensFn(),
		staleTime: 60_000,
	});
