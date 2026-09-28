import { createServerFn } from "@tanstack/react-start";
import {
	createNotificationCode,
	deleteNotificationCode,
	listNotificationCodes,
} from "#/data/notification-code.server";
import type { Scope } from "#/data/team.server";
import { AppError } from "#/lib/errors";
import {
	createNotificationCodeInputSchema,
	deleteNotificationCodeInputSchema,
} from "#/schemas/notification-code";
import { roleCan } from "#/schemas/team";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";
import { requireScope } from "./scope";

/**
 * Where notification codes may be made: your own space, or a team you are a
 * project manager or the admin of — who alone can message it.
 */
async function requireCodeScope(): Promise<Scope> {
	const scope = await requireScope();
	if (scope.team !== null && !roleCan(scope.team.role, "manageContent")) {
		throw new AppError(
			"invalid_data",
			"Only the team's project managers can make notification codes.",
		);
	}
	return scope;
}

/** Your codes in the space being worked in. */
export const listNotificationCodesFn = createServerFn().handler(() =>
	guard("listNotificationCodes", async () => {
		const scope = await requireCodeScope();
		return listNotificationCodes(scope.ownerId, scope.email);
	}),
);

export const createNotificationCodeFn = createServerFn({ method: "POST" })
	.validator(validator(createNotificationCodeInputSchema))
	.handler(({ data }) =>
		guard("createNotificationCode", async () => {
			const scope = await requireCodeScope();
			await createNotificationCode(
				scope.ownerId,
				scope.email,
				scope.team,
				data,
			);
		}),
	);

export const deleteNotificationCodeFn = createServerFn({ method: "POST" })
	.validator(validator(deleteNotificationCodeInputSchema))
	.handler(({ data }) =>
		guard("deleteNotificationCode", async () => {
			const scope = await requireCodeScope();
			await deleteNotificationCode(scope.ownerId, scope.email, data.code);
		}),
	);
