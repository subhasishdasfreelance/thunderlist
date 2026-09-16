import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import {
	getChecklist,
	getChecklistCompleted,
	getChecklistStageTasks,
	listChecklists,
} from "#/data/checklist.server";
import { assertLevel } from "#/data/visibility.server";
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
			assertLevel(scope, "checklists", data.checklistId, "read");
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
			assertLevel(scope, "checklists", data.checklistId, "read");
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
			assertLevel(scope, "checklists", data.checklistId, "read");
			return getChecklistCompleted(
				scope.ownerId,
				data.checklistId,
				scope.hidden,
			);
		}),
	);
