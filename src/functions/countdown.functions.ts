import { createServerFn } from "@tanstack/react-start";
import { listCountdowns } from "#/data/countdown.server";
import { guard } from "./guard";
import { requireScope } from "./scope";

/** Every countdown in the space they can see; see `Countdown`. */
export const listCountdownsFn = createServerFn().handler(() =>
	guard("listCountdowns", async () => {
		const scope = await requireScope();
		return listCountdowns(scope.ownerId, scope.hidden);
	}),
);
