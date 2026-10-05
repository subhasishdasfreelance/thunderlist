import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import { deleteUnusedImages } from "#/data/image-cleanup.server";
import { MAX_IMAGES } from "#/schemas/common";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";
import { requireScope } from "./scope";

const discardImagesInputSchema = v.object({
	ids: v.pipe(
		v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
		v.maxLength(MAX_IMAGES),
	),
});

/**
 * Throw away pictures uploaded in a dialog that was then cancelled; see
 * `useImageDraft`. Only this space's own — filed under its owner, see
 * `imageRouter` — and only those nothing carries, so a picture already on
 * something can never be taken by naming it.
 */
export const discardImagesFn = createServerFn({ method: "POST" })
	.validator(validator(discardImagesInputSchema))
	.handler(({ data }) =>
		guard("discardImages", async () => {
			const { ownerId } = await requireScope();
			await deleteUnusedImages(
				ownerId,
				data.ids.filter((id) => id.startsWith(`${ownerId}/`)),
			);
		}),
	);
