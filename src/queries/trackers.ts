import { queryOptions } from "@tanstack/react-query";
import { getTrackerFn, listTrackersFn } from "#/functions/tracker.functions";
import { queryKeys } from "./keys";

export const trackersQuery = () =>
	queryOptions({
		queryKey: queryKeys.trackers,
		queryFn: () => listTrackersFn(),
	});

export const trackerQuery = (trackerId: string) =>
	queryOptions({
		queryKey: queryKeys.tracker(trackerId),
		queryFn: () => getTrackerFn({ data: { trackerId } }),
	});
