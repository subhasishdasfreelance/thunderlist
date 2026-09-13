import { createServerFn } from "@tanstack/react-start";
import {
	getTracker,
	getTrackerEntries,
	listTrackers,
} from "#/data/tracker.server";
import { assertTrackerVisible } from "#/data/visibility.server";
import { trackerIdInputSchema } from "#/schemas/tracker";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";
import { requireScope } from "./scope";

export const listTrackersFn = createServerFn().handler(() =>
	guard("listTrackers", async () => {
		const scope = await requireScope();
		return listTrackers(scope.ownerId, scope.hidden);
	}),
);

export const getTrackerFn = createServerFn()
	.validator(validator(trackerIdInputSchema))
	.handler(({ data }) =>
		guard("getTracker", async () => {
			const scope = await requireScope();
			assertTrackerVisible(scope.hidden, data.trackerId);
			return getTracker(scope.ownerId, data.trackerId);
		}),
	);

export const getTrackerEntriesFn = createServerFn()
	.validator(validator(trackerIdInputSchema))
	.handler(({ data }) =>
		guard("getTrackerEntries", async () => {
			const scope = await requireScope();
			assertTrackerVisible(scope.hidden, data.trackerId);
			return getTrackerEntries(scope.ownerId, data.trackerId);
		}),
	);
