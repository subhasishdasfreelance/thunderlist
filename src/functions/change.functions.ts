import { createServerFn } from "@tanstack/react-start";
import { applyChange } from "#/data/change.server";
import { applyChangeInputSchema } from "#/schemas/change";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";

/**
 * Make one change.
 *
 * The single write endpoint: every mutation in the app is a `Change`, so there
 * is one place that validates, one place that sanitises errors, and nothing to
 * keep in step as operations are added.
 */
export const applyChangeFn = createServerFn({ method: "POST" })
	.validator(validator(applyChangeInputSchema))
	.handler(({ data }) => guard("applyChange", () => applyChange(data.change)));
