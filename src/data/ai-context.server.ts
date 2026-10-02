/**
 * What every AI tool handler is given and gives back. Server only; see
 * `runAiTool`.
 */

import type { SignedInUser } from "#/lib/auth.server";
import type { AiToolInput, AiToolName } from "#/schemas/ai-tools";
import type { Change } from "#/schemas/change";
import type { Lookup } from "./ai-lookup.server";
import type { Scope } from "./team.server";

/** Who is asking, where, and how to move them to another space. */
export type AiContext = {
	scope: Scope;
	person: SignedInUser;
	/** `YYYY-MM-DD` on the asker's calendar, where it is known. */
	today: string;
	/**
	 * Work in another space from the next call on: the tab's cookie for
	 * WebMCP, the token's own record for MCP. `null` for their own space.
	 */
	switchSpace: (teamId: string | null) => Promise<void>;
};

export type AiOutcome = {
	/** What to make, in order; none for a read or a team operation. */
	changes: Array<Change>;
	/** What the agent is told, as JSON. */
	result: unknown;
	/** The space being worked in changed, so the tab starts afresh in it. */
	spaceChanged?: boolean;
};

export type AiHandler<TName extends AiToolName> = (
	context: AiContext,
	input: AiToolInput<TName>,
	look: Lookup,
) => Promise<AiOutcome>;

export type AiHandlers<TName extends AiToolName> = {
	[Name in TName]: AiHandler<Name>;
};

/** A tool's answer that changes nothing. */
export function answer(result: unknown, spaceChanged = false): AiOutcome {
	return { changes: [], result, spaceChanged };
}
