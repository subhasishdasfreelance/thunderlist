import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { personForAiToken, setAiTokenSpace } from "#/data/ai-token.server";
import {
	AI_INSTRUCTIONS,
	applyAiChanges,
	listAiTools,
	runAiTool,
} from "#/data/ai-tools.server";
import { ensureNumbered } from "#/data/numbers.server";
import { resolveScope } from "#/data/team.server";
import { guard } from "#/functions/guard";
import { collections } from "#/lib/mongo/client.server";
import { aiTokenSecretSchema } from "#/schemas/ai-token";
import { todayDateOnly } from "#/schemas/common";

/**
 * Open to any origin, as `/api/notify` is: the token is what keeps strangers
 * out, and it travels in a header no other site can make a browser send.
 */
const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "POST, OPTIONS",
	"access-control-allow-headers":
		"Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id",
};

function withCors(response: Response): Response {
	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(CORS_HEADERS)) {
		headers.set(name, value);
	}
	return new Response(response.body, { status: response.status, headers });
}

function refusal(message: string, status: number): Response {
	return withCors(
		Response.json(
			{ jsonrpc: "2.0", error: { code: -32001, message }, id: null },
			{
				status,
				headers:
					status === 401
						? { "www-authenticate": 'Bearer realm="thunderlist"' }
						: undefined,
			},
		),
	);
}

/**
 * The MCP server: every tool in `AI_TOOLS`, for an assistant outside the
 * browser, acting as whoever made the AI access token it sends as
 * `Authorization: Bearer tla_…`.
 *
 * Stateless — a server for each request, answering in JSON — so it runs
 * wherever the app does, with nothing kept between calls but the token's own
 * space; see `switch_space`. A tool's changes are made here, one after
 * another, through the same `applyChange` every edit goes through.
 */
async function mcp(request: Request): Promise<Response> {
	const header = request.headers.get("authorization") ?? "";
	const secret = v.safeParse(
		aiTokenSecretSchema,
		header.replace(/^Bearer\s+/i, ""),
	);
	const holder = secret.success ? await personForAiToken(secret.output) : null;
	if (holder === null) {
		return refusal(
			"Send an AI access token as Authorization: Bearer tla_…. Make one in Thunderlist, under Settings → AI assistants.",
			401,
		);
	}

	const server = new Server(
		{ name: "thunderlist", title: "Thunderlist", version: "1.0.0" },
		{ capabilities: { tools: {} }, instructions: AI_INSTRUCTIONS },
	);

	server.setRequestHandler(ListToolsRequestSchema, () => ({
		tools: listAiTools().map((tool) => ({
			name: tool.name,
			title: tool.title,
			description: tool.description,
			inputSchema: { type: "object" as const, ...tool.inputSchema },
			annotations: { title: tool.title, ...tool.annotations },
		})),
	}));

	server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
		try {
			const result = await guard(`mcp ${params.name}`, async () => {
				const scope = await resolveScope(
					holder.person,
					holder.teamId ?? undefined,
				);
				await ensureNumbered(await collections(), scope.ownerId);

				const outcome = await runAiTool(
					{
						scope,
						person: holder.person,
						// The server's calendar: an MCP client does not say its own.
						today: todayDateOnly(),
						switchSpace: (teamId) => setAiTokenSpace(holder.tokenId, teamId),
					},
					params.name,
					params.arguments,
				);
				await applyAiChanges(scope, outcome.changes);
				return outcome.result;
			});
			return {
				content: [{ type: "text" as const, text: JSON.stringify(result) }],
			};
		} catch (error) {
			return {
				isError: true,
				content: [
					{
						type: "text" as const,
						text: error instanceof Error ? error.message : String(error),
					},
				],
			};
		}
	});

	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);
	return withCors(await transport.handleRequest(request));
}

export const Route = createFileRoute("/api/mcp")({
	server: {
		handlers: {
			POST: ({ request }) => mcp(request),
			// Stateless: there is no stream to open and no session to end.
			GET: () => refusal("Send MCP requests with POST.", 405),
			DELETE: () => refusal("There is no session to end.", 405),
			OPTIONS: () => new Response(null, { status: 204, headers: CORS_HEADERS }),
		},
	},
});
