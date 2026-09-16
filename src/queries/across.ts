import { queryOptions } from "@tanstack/react-query";
import { getAcrossTasksFn } from "#/functions/across.functions";
import type { AcrossPageView } from "#/schemas/task";
import { queryKeys } from "./keys";

/** One group of the Across lists screen, one page of it; see `getAcrossTasks`. */
export const acrossQuery = (view: AcrossPageView) =>
	queryOptions({
		queryKey: queryKeys.acrossPage(view),
		queryFn: () => getAcrossTasksFn({ data: view }),
	});
