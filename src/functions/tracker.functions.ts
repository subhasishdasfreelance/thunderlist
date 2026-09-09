import { createServerFn } from "@tanstack/react-start";
import {
	getTracker,
	getTrackerEntries,
	listTrackers,
} from "#/data/tracker.server";
import { requireUserId } from "#/lib/auth.server";
import { trackerIdInputSchema } from "#/schemas/tracker";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";

export const listTrackersFn = createServerFn().handler(() =>
	guard("listTrackers", async () => listTrackers(await requireUserId())),
);

export const getTrackerFn = createServerFn()
	.validator(validator(trackerIdInputSchema))
	.handler(({ data }) =>
		guard("getTracker", async () =>
			getTracker(await requireUserId(), data.trackerId),
		),
	);

export const getTrackerEntriesFn = createServerFn()
	.validator(validator(trackerIdInputSchema))
	.handler(({ data }) =>
		guard("getTrackerEntries", async () =>
			getTrackerEntries(await requireUserId(), data.trackerId),
		),
	);
