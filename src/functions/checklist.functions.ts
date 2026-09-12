import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import {
	getChecklist,
	getChecklistCompleted,
	getChecklistOpenTasks,
	listChecklists,
} from "#/data/checklist.server";
import { requireUserId } from "#/lib/auth.server";
import { checklistIdInputSchema } from "#/schemas/checklist";
import { taskPageSchema } from "#/schemas/task";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";

export const listChecklistsFn = createServerFn().handler(() =>
	guard("listChecklists", async () => listChecklists(await requireUserId())),
);

export const getChecklistFn = createServerFn()
	.validator(validator(checklistIdInputSchema))
	.handler(({ data }) =>
		guard("getChecklist", async () =>
			getChecklist(await requireUserId(), data.checklistId),
		),
	);

export const getChecklistOpenTasksFn = createServerFn()
	.validator(
		validator(
			v.object({
				...checklistIdInputSchema.entries,
				...taskPageSchema.entries,
			}),
		),
	)
	.handler(({ data }) =>
		guard("getChecklistOpenTasks", async () =>
			getChecklistOpenTasks(await requireUserId(), data.checklistId, data),
		),
	);

export const getChecklistCompletedFn = createServerFn()
	.validator(validator(checklistIdInputSchema))
	.handler(({ data }) =>
		guard("getChecklistCompleted", async () =>
			getChecklistCompleted(await requireUserId(), data.checklistId),
		),
	);
