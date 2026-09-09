import { createServerFn } from "@tanstack/react-start";
import { getTracker, listTrackers } from "#/data/tracker.server";
import { trackerIdInputSchema } from "#/schemas/tracker";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";

export const listTrackersFn = createServerFn().handler(() =>
	guard("listTrackers", () => listTrackers()),
);

export const getTrackerFn = createServerFn()
	.validator(validator(trackerIdInputSchema))
	.handler(({ data }) => guard("getTracker", () => getTracker(data.trackerId)));
