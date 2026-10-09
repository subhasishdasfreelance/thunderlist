import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import {
	getBackdrops,
	getColorScheme,
	setBackdrop,
	setColorScheme,
} from "#/data/preferences.server";
import { requireUser } from "#/lib/auth.server";
import { COLOR_SCHEMES } from "#/lib/theme";
import { setBackdropInputSchema } from "#/schemas/backdrop";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";

/**
 * The illustration each page shows this person. Their own, whichever space
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

/** Their light or dark, kept on the account; see `useAccountColorScheme`. */
export const getColorSchemeFn = createServerFn().handler(() =>
	guard("getColorScheme", async () =>
		getColorScheme((await requireUser()).userId),
	),
);

export const setColorSchemeFn = createServerFn({ method: "POST" })
	.validator(validator(v.object({ colorScheme: v.picklist(COLOR_SCHEMES) })))
	.handler(({ data }) =>
		guard("setColorScheme", async () =>
			setColorScheme((await requireUser()).userId, data.colorScheme),
		),
	);
