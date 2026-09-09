import { createServerFn } from "@tanstack/react-start";
import { applyChanges } from "#/data/apply.server";
import { applyChangesInputSchema } from "#/schemas/pending";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";

/**
 * Write a reviewed batch of queued changes to the database.
 *
 * The changes are replayed in the order the user built them and stop at the
 * first failure, so what came back as applied is exactly what landed.
 */
export const applyChangesFn = createServerFn({ method: "POST" })
	.validator(validator(applyChangesInputSchema))
	.handler(({ data }) =>
		guard("applyChanges", () => applyChanges(data.changes)),
	);
