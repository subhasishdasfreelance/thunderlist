import { createServerFn } from "@tanstack/react-start";
import {
	getTag,
	getTagCompleted,
	listTagSummaries,
	listTags,
} from "#/data/tag.server";
import { requireUserId } from "#/lib/auth.server";
import { tagIdInputSchema } from "#/schemas/tag";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";

export const listTagsFn = createServerFn().handler(() =>
	guard("listTags", async () => listTags(await requireUserId())),
);

export const listTagSummariesFn = createServerFn().handler(() =>
	guard("listTagSummaries", async () =>
		listTagSummaries(await requireUserId()),
	),
);

export const getTagFn = createServerFn()
	.validator(validator(tagIdInputSchema))
	.handler(({ data }) =>
		guard("getTag", async () => getTag(await requireUserId(), data.tagId)),
	);

export const getTagCompletedFn = createServerFn()
	.validator(validator(tagIdInputSchema))
	.handler(({ data }) =>
		guard("getTagCompleted", async () =>
			getTagCompleted(await requireUserId(), data.tagId),
		),
	);
