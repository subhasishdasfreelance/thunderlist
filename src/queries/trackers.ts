import { queryOptions } from "@tanstack/react-query";
import {
	getTrackerEntriesFn,
	getTrackerFn,
	listTrackersFn,
} from "#/functions/tracker.functions";
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

/** Loaded after the tracker itself; see `TrackerDetail`. */
export const trackerEntriesQuery = (trackerId: string) =>
	queryOptions({
		queryKey: queryKeys.trackerEntries(trackerId),
		queryFn: () => getTrackerEntriesFn({ data: { trackerId } }),
	});
