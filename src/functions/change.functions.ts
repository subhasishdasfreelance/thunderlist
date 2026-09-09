import { createServerFn } from "@tanstack/react-start";
import { applyChange } from "#/data/change.server";
import { requireUserId } from "#/lib/auth.server";
import { applyChangeInputSchema } from "#/schemas/change";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";

/**
 * Make one change.
 *
 * The single write endpoint: every mutation in the app is a `Change`, so there
 * is one place that validates, one place that sanitises errors, one place that
 * establishes who is asking — and nothing to keep in step as operations are
 * added.
 *
 * The change names ids the browser minted, so it can name anything. Which rows
 * those ids are allowed to reach is decided by the id this reads out of the
 * session, and by nothing in the request.
 */
export const applyChangeFn = createServerFn({ method: "POST" })
	.validator(validator(applyChangeInputSchema))
	.handler(({ data }) =>
		guard("applyChange", async () =>
			applyChange(await requireUserId(), data.change),
		),
	);
