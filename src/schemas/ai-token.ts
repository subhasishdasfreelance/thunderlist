import * as v from "valibot";
import { idSchema } from "./common";

/**
 * An AI access token: a secret an assistant outside the browser — Claude
 * Code, Claude Desktop, any MCP client — sends to `/api/mcp` to use
 * Thunderlist as the person who made it, with every tool in `AI_TOOLS`.
 *
 * It can do whatever its person can, so it is shown once, when it is made,
 * and only a hash of it is kept. Each works in one space at a time — the one
 * it was made in, until the assistant switches; see `switch_space`. Deleting
 * it stops it at once.
 *
 * An agent in the browser needs none: WebMCP works through the session the
 * tab is signed in with.
 */
export type AiToken = {
	tokenId: string;
	label: string;
	/** Its last four characters, to tell it apart. */
	hint: string;
	/** The space it works in; `null` for its person's own. */
	space: { teamId: string; name: string } | null;
	createdAt: string;
	lastUsedAt: string | null;
};

/** `tla_` and 40 random characters; see `createAiTokenSecret`. */
export const aiTokenSecretSchema = v.pipe(
	v.string(),
	v.trim(),
	v.regex(/^tla_[0-9a-z]{40}$/, "That is not an AI access token"),
);

export const createAiTokenInputSchema = v.object({
	tokenId: idSchema,
	secret: aiTokenSecretSchema,
	label: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, "A name is required"),
		v.maxLength(60, "The name must be 60 characters or fewer"),
	),
});

export type CreateAiTokenInput = v.InferOutput<typeof createAiTokenInputSchema>;

export const aiTokenIdInputSchema = v.object({ tokenId: idSchema });

/** One tool call from a tab, for WebMCP; see `runAiToolFn`. */
export const runAiToolInputSchema = v.object({
	name: v.pipe(v.string(), v.maxLength(64)),
	input: v.optional(v.record(v.string(), v.unknown()), {}),
	/** The tab's own calendar day, which the server does not know. */
	today: v.pipe(v.string(), v.isoDate()),
});
