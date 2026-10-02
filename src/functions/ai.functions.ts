import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, setCookie } from "@tanstack/react-start/server";
import {
	createAiToken,
	deleteAiToken,
	listAiTokens,
} from "#/data/ai-token.server";
import { listAiTools, runAiTool } from "#/data/ai-tools.server";
import { requireUser } from "#/lib/auth.server";
import {
	aiTokenIdInputSchema,
	createAiTokenInputSchema,
	runAiToolInputSchema,
} from "#/schemas/ai-token";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";
import { requireScope, SPACE_COOKIE } from "./scope";
import { SPACE_COOKIE_OPTIONS } from "./team.functions";

/** Your AI access tokens, whichever space you are in; see `AiToken`. */
export const listAiTokensFn = createServerFn().handler(() =>
	guard("listAiTokens", async () => listAiTokens((await requireUser()).userId)),
);

/** Make one, working in the space being worked in now. */
export const createAiTokenFn = createServerFn({ method: "POST" })
	.validator(validator(createAiTokenInputSchema))
	.handler(({ data }) =>
		guard("createAiToken", async () => {
			const [user, scope] = await Promise.all([requireUser(), requireScope()]);
			await createAiToken(user.userId, scope.team?.teamId ?? null, data);
		}),
	);

export const deleteAiTokenFn = createServerFn({ method: "POST" })
	.validator(validator(aiTokenIdInputSchema))
	.handler(({ data }) =>
		guard("deleteAiToken", async () =>
			deleteAiToken((await requireUser()).userId, data.tokenId),
		),
	);

/**
 * Every AI tool, for the tab to offer through WebMCP; see `useWebMcp`. As
 * JSON: an input's JSON Schema is open-ended, which a server function's
 * answer cannot be typed as.
 */
export const listAiToolsFn = createServerFn().handler(() =>
	guard("listAiTools", async () => {
		await requireUser();
		return JSON.stringify(listAiTools());
	}),
);

/**
 * One AI tool, called from the tab for an agent in the browser; see
 * `useWebMcp`. The session is the tab's own, so the agent is its person.
 *
 * Changes come back unmade, for the tab to make through `useApplyChange` —
 * drawn at once and undoable like anything typed. Anything else is done here.
 * The result is JSON, as the agent is given it.
 */
export const runAiToolFn = createServerFn({ method: "POST" })
	.validator(validator(runAiToolInputSchema))
	.handler(({ data }) =>
		guard("runAiTool", async () => {
			const [person, scope] = await Promise.all([
				requireUser(),
				requireScope(),
			]);
			const outcome = await runAiTool(
				{
					scope,
					person,
					today: data.today,
					switchSpace: async (teamId) => {
						if (teamId === null) deleteCookie(SPACE_COOKIE, { path: "/" });
						else setCookie(SPACE_COOKIE, teamId, SPACE_COOKIE_OPTIONS);
					},
				},
				data.name,
				data.input,
			);
			return {
				changes: outcome.changes,
				result: JSON.stringify(outcome.result),
				spaceChanged: outcome.spaceChanged === true,
			};
		}),
	);
