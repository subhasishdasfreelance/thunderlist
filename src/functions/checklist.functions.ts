import { createServerFn } from "@tanstack/react-start";
import { getChecklist, listChecklists } from "#/data/checklist.server";
import { checklistIdInputSchema } from "#/schemas/checklist";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";

export const listChecklistsFn = createServerFn().handler(() =>
	guard("listChecklists", () => listChecklists()),
);

export const getChecklistFn = createServerFn()
	.validator(validator(checklistIdInputSchema))
	.handler(({ data }) =>
		guard("getChecklist", () => getChecklist(data.checklistId)),
	);
