/**
 * Running one AI tool. Server only; see `AI_TOOLS` for the catalog.
 *
 * A tool that changes content does not write anything here: it works out the
 * `Change`s that do what was asked — ids minted, names resolved — exactly as a
 * screen's builders would, and hands them back with what to tell the agent.
 * Whoever called then makes them the way it makes every change:
 *
 * - the MCP endpoint applies them on the server, one after another, through
 *   `applyChange` — the same checks as any edit; see `applyAiChanges`;
 * - the open tab, for WebMCP, applies them through `useApplyChange`, so they
 *   are drawn at once, heard, and undone with Ctrl+Z like anything typed.
 *
 * Everything else — reading, and running a team, which is not a `Change` in
 * the app either — happens here, under the same scope and the same checks as
 * the screens' own server functions.
 */

import { toJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";
import { AppError } from "#/lib/errors";
import {
	AI_TOOLS,
	type AiToolInput,
	type AiToolListing,
	type AiToolName,
	isAiToolName,
} from "#/schemas/ai-tools";
import { applyChangeInputSchema, type Change } from "#/schemas/change";
import { ACCOUNT_TOOLS } from "./ai-account.server";
import type {
	AiContext,
	AiHandler,
	AiHandlers,
	AiOutcome,
} from "./ai-context.server";
import { createLookup } from "./ai-lookup.server";
import { READ_TOOLS } from "./ai-reads.server";
import { WRITE_TOOLS } from "./ai-writes.server";
import { applyChange } from "./change.server";
import type { Scope } from "./team.server";

const HANDLERS: AiHandlers<AiToolName> = {
	...READ_TOOLS,
	...WRITE_TOOLS,
	...ACCOUNT_TOOLS,
};

/** The first problem with an input, saying where it is. */
function firstIssue(issues: ReadonlyArray<v.BaseIssue<unknown>>): string {
	const issue = issues[0];
	const path = v.getDotPath(issue);
	return path === null ? issue.message : `${path}: ${issue.message}`;
}

/**
 * Work out what one tool call does. Its input is checked against the catalog,
 * and every change it makes against the schema every edit is checked with —
 * so a change an agent asks for is refused, in the same words, wherever a
 * screen's would be.
 */
export async function runAiTool(
	context: AiContext,
	name: string,
	input: unknown,
): Promise<AiOutcome> {
	if (!isAiToolName(name)) {
		throw new AppError("invalid_data", `There is no tool called ${name}.`);
	}

	const parsed = v.safeParse(AI_TOOLS[name].input, input ?? {});
	if (!parsed.success) {
		throw new AppError("invalid_data", firstIssue(parsed.issues));
	}

	const handler = HANDLERS[name] as AiHandler<typeof name>;
	const outcome = await handler(
		context,
		parsed.output as AiToolInput<typeof name>,
		createLookup(context.scope),
	);

	return {
		...outcome,
		changes: outcome.changes.map((change) => {
			const checked = v.safeParse(applyChangeInputSchema, { change });
			if (!checked.success) {
				// The change is this file's making, so its path means nothing to the agent.
				throw new AppError("invalid_data", checked.issues[0].message);
			}
			return checked.output.change;
		}),
	};
}

/**
 * Make a tool's changes on the server, in order, for an agent with no tab
 * open; see `runAiTool`. Each is checked and written as one from a screen.
 */
export async function applyAiChanges(
	scope: Scope,
	changes: ReadonlyArray<Change>,
): Promise<void> {
	for (const change of changes) await applyChange(scope, change);
}

/** Every tool, with its input as JSON Schema, for MCP and WebMCP to list. */
export function listAiTools(): Array<AiToolListing> {
	return (Object.keys(AI_TOOLS) as Array<AiToolName>).map((name) => {
		const tool: (typeof AI_TOOLS)[AiToolName] = AI_TOOLS[name];
		// Trims and transforms have no JSON Schema; the input is checked anyway.
		const { $schema: _, ...inputSchema } = toJsonSchema(tool.input, {
			errorMode: "ignore",
		});
		return {
			name,
			title: tool.title,
			description: tool.description,
			inputSchema,
			annotations: {
				readOnlyHint: "readOnly" in tool && tool.readOnly === true,
				destructiveHint: "destructive" in tool && tool.destructive === true,
			},
		};
	});
}

/** What an agent is told before it uses any tool. */
export const AI_INSTRUCTIONS =
	"Thunderlist is a productivity app: checklists of tasks that move through stages, tags (Today is the special one), trackers for measurable goals, groups, plans and countdowns, for one person or a team. Call get_workspace first to learn the space, today's date, the Today tag and the task types. Things can be named by id, by number (T-42, C-3, TR-7, TG-2, P-4, CD-2, G-1, E-15) or by exact name; use search or the list tools to find them. Dates are YYYY-MM-DD. Everything acts on the space being worked in; switch_space changes it.";
