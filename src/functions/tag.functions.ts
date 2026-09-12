import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import {
	getTag,
	getTagCompleted,
	getTagOpenTasks,
	listTagSummaries,
	listTags,
} from "#/data/tag.server";
import { requireUserId } from "#/lib/auth.server";
import { tagIdInputSchema } from "#/schemas/tag";
import { taskPageSchema } from "#/schemas/task";
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

export const getTagOpenTasksFn = createServerFn()
	.validator(
		validator(
			v.object({ ...tagIdInputSchema.entries, ...taskPageSchema.entries }),
		),
	)
	.handler(({ data }) =>
		guard("getTagOpenTasks", async () =>
			getTagOpenTasks(await requireUserId(), data.tagId, data),
		),
	);

export const getTagCompletedFn = createServerFn()
	.validator(validator(tagIdInputSchema))
	.handler(({ data }) =>
		guard("getTagCompleted", async () =>
			getTagCompleted(await requireUserId(), data.tagId),
		),
	);
