import { createServerFn } from "@tanstack/react-start";
import { getBackdrops, setBackdrop } from "#/data/preferences.server";
import { requireUser } from "#/lib/auth.server";
import { setBackdropInputSchema } from "#/schemas/backdrop";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";

/**
 * The illustration each section shows this person. Their own, whichever space
 * they are working in, so it asks who they are rather than where.
 */
export const getBackdropsFn = createServerFn().handler(() =>
	guard("getBackdrops", async () => getBackdrops((await requireUser()).userId)),
);

export const setBackdropFn = createServerFn({ method: "POST" })
	.validator(validator(setBackdropInputSchema))
	.handler(({ data }) =>
		guard("setBackdrop", async () =>
			setBackdrop((await requireUser()).userId, data),
		),
	);
