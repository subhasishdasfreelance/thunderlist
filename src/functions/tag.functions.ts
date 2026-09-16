import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import {
	getTag,
	getTagCompleted,
	getTagOpenTasks,
	listTagSummaries,
	listTags,
} from "#/data/tag.server";
import { tagIdInputSchema, tagReadInputSchema } from "#/schemas/tag";
import { taskPageSchema } from "#/schemas/task";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";
import { requireScope } from "./scope";

export const listTagsFn = createServerFn().handler(() =>
	guard("listTags", async () => {
		const scope = await requireScope();
		return listTags(scope.ownerId, scope.hidden);
	}),
);

export const listTagSummariesFn = createServerFn().handler(() =>
	guard("listTagSummaries", async () => {
		const scope = await requireScope();
		return listTagSummaries(scope.ownerId, scope.hidden);
	}),
);

export const getTagFn = createServerFn()
	.validator(validator(tagReadInputSchema))
	.handler(({ data }) =>
		guard("getTag", async () => {
			const scope = await requireScope();
			return getTag(scope.ownerId, data.tagId, scope.hidden, {
				assignee: data.assignee,
				type: data.type,
			});
		}),
	);

export const getTagOpenTasksFn = createServerFn()
	.validator(
		validator(
			v.object({ ...tagIdInputSchema.entries, ...taskPageSchema.entries }),
		),
	)
	.handler(({ data }) =>
		guard("getTagOpenTasks", async () => {
			const scope = await requireScope();
			return getTagOpenTasks(scope.ownerId, data.tagId, data, scope.hidden);
		}),
	);

export const getTagCompletedFn = createServerFn()
	.validator(validator(tagIdInputSchema))
	.handler(({ data }) =>
		guard("getTagCompleted", async () => {
			const scope = await requireScope();
			return getTagCompleted(scope.ownerId, data.tagId, scope.hidden);
		}),
	);
