import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import {
	getChecklist,
	getChecklistCompleted,
	getChecklistStageTasks,
	listChecklists,
} from "#/data/checklist.server";
import { assertChecklistVisible } from "#/data/visibility.server";
import {
	checklistIdInputSchema,
	checklistReadInputSchema,
} from "#/schemas/checklist";
import { taskPageSchema } from "#/schemas/task";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";
import { requireScope } from "./scope";

export const listChecklistsFn = createServerFn().handler(() =>
	guard("listChecklists", async () => {
		const scope = await requireScope();
		return listChecklists(scope.ownerId, scope.hidden);
	}),
);

export const getChecklistFn = createServerFn()
	.validator(validator(checklistReadInputSchema))
	.handler(({ data }) =>
		guard("getChecklist", async () => {
			const scope = await requireScope();
			assertChecklistVisible(scope.hidden, data.checklistId);
			return getChecklist(scope.ownerId, data.checklistId, scope.hidden, {
				assignee: data.assignee,
				tag: data.tag,
			});
		}),
	);

export const getChecklistStageTasksFn = createServerFn()
	.validator(
		validator(
			v.object({
				...checklistIdInputSchema.entries,
				...taskPageSchema.entries,
			}),
		),
	)
	.handler(({ data }) =>
		guard("getChecklistStageTasks", async () => {
			const scope = await requireScope();
			assertChecklistVisible(scope.hidden, data.checklistId);
			return getChecklistStageTasks(
				scope.ownerId,
				data.checklistId,
				data,
				scope.hidden,
			);
		}),
	);

export const getChecklistCompletedFn = createServerFn()
	.validator(validator(checklistIdInputSchema))
	.handler(({ data }) =>
		guard("getChecklistCompleted", async () => {
			const scope = await requireScope();
			assertChecklistVisible(scope.hidden, data.checklistId);
			return getChecklistCompleted(
				scope.ownerId,
				data.checklistId,
				scope.hidden,
			);
		}),
	);
