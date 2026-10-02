import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { listAiToolsFn, runAiToolFn } from "#/functions/ai.functions";
import { useApplyChange } from "#/lib/changes";
import { errorMessage } from "#/lib/errors";
import { useSpaceChanged } from "#/lib/use-space-changed";
import type { AiToolListing } from "#/schemas/ai-tools";
import { todayDateOnly } from "#/schemas/common";

/** What a tool hands back to the agent: text, as MCP's tools do. */
type ToolAnswer = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
};

type WebMcpTool = {
	name: string;
	title: string;
	description: string;
	inputSchema: Record<string, unknown>;
	annotations: { readOnlyHint: boolean };
	execute: (input: Record<string, unknown>) => Promise<ToolAnswer>;
};

/**
 * WebMCP as the browser offers it: on `document` now, on `navigator` in the
 * Chrome builds before 150. A tool is taken back by aborting the signal it was
 * registered with — or, in those builds, by name.
 */
type ModelContext = {
	registerTool: (
		tool: WebMcpTool,
		options?: { signal?: AbortSignal },
	) => unknown;
	unregisterTool?: (name: string) => void;
};

function modelContext(): ModelContext | null {
	const holders = [document, navigator] as Array<{
		modelContext?: ModelContext;
	}>;
	return holders.find((each) => each.modelContext)?.modelContext ?? null;
}

function said(text: string, isError = false): ToolAnswer {
	return { content: [{ type: "text", text }], ...(isError ? { isError } : {}) };
}

/**
 * Offer every AI tool to an agent working in this tab, through WebMCP; see
 * `AI_TOOLS`. Nothing happens in a browser without it.
 *
 * The agent is whoever the tab is signed in as, in the space it is working
 * in. Each call is worked out on the server (`runAiToolFn`), and the changes
 * it comes back with are made here, through `useApplyChange`, one after
 * another — so what the agent does is drawn the moment it is asked, heard,
 * and undone with Ctrl+Z like anything typed.
 *
 * One tool is the tab's alone: `open_page`, to show the person something.
 */
export function useWebMcp(): void {
	const { applyAsync } = useApplyChange();
	const queryClient = useQueryClient();
	const router = useRouter();
	const spaceChanged = useSpaceChanged();

	// The tools are registered once; each call uses whatever is current then.
	const current = useRef({ applyAsync, queryClient, router, spaceChanged });
	current.current = { applyAsync, queryClient, router, spaceChanged };

	useEffect(() => {
		const context = modelContext();
		if (context === null) return;

		const registration = new AbortController();
		const names: Array<string> = [];

		function offer(tool: WebMcpTool) {
			try {
				// A promise in the spec, refused for a name already taken.
				void Promise.resolve(
					context?.registerTool(tool, { signal: registration.signal }),
				).catch(() => {});
				names.push(tool.name);
			} catch {
				// This tool is not offered; the others still are.
			}
		}

		async function run(
			tool: AiToolListing,
			input: Record<string, unknown>,
		): Promise<ToolAnswer> {
			const { applyAsync, queryClient, spaceChanged } = current.current;
			try {
				const outcome = await runAiToolFn({
					data: { name: tool.name, input, today: todayDateOnly() },
				});
				for (const change of outcome.changes) await applyAsync(change);

				if (outcome.spaceChanged) await spaceChanged();
				// Run on the server, not drawn here: read afresh.
				else if (
					outcome.changes.length === 0 &&
					!tool.annotations.readOnlyHint
				) {
					await queryClient.invalidateQueries();
				}
				return said(outcome.result);
			} catch (error) {
				return said(errorMessage(error), true);
			}
		}

		listAiToolsFn()
			.then((json) => {
				if (registration.signal.aborted) return;
				for (const tool of JSON.parse(json) as Array<AiToolListing>) {
					offer({
						name: tool.name,
						title: tool.title,
						description: tool.description,
						inputSchema: tool.inputSchema,
						annotations: { readOnlyHint: tool.annotations.readOnlyHint },
						execute: (input) => run(tool, input ?? {}),
					});
				}
			})
			.catch(() => {
				// Signed out since, or offline: there is nothing to offer.
			});

		offer({
			name: "open_page",
			title: "Open page",
			description:
				"Show a page of Thunderlist in this tab, by its path: the path another tool gave, such as /checklists/chk_… or /tags/today, or a screen: /priority, /stages, /tags, /trackers, /groups, /plans, /countdowns, /settings.",
			inputSchema: {
				type: "object",
				properties: { path: { type: "string" } },
				required: ["path"],
			},
			annotations: { readOnlyHint: true },
			execute: async (input) => {
				const path = typeof input.path === "string" ? input.path.trim() : "";
				// The app's own pages only, never somewhere else.
				if (!/^\/(?!\/)/.test(path)) {
					return said("A path starts with a single /.", true);
				}
				await current.current.router.navigate({ href: path });
				return said(JSON.stringify({ opened: path }));
			},
		});

		return () => {
			registration.abort();
			for (const name of names) {
				try {
					context.unregisterTool?.(name);
				} catch {
					// Already gone with the signal.
				}
			}
		};
	}, []);
}
