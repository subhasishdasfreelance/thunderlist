import { createFileRoute } from "@tanstack/react-router";
import { announceRelease } from "#/data/release.server";
import { BUILD_ID } from "#/lib/version";

/**
 * Which build the server is running, for a page left open to compare with its
 * own; see `useNewVersionPrompt`. Never cached: a kept answer would hide the
 * very deploy it is asked about.
 *
 * The first time a release is asked, it is announced to everyone; see
 * `announceRelease`.
 */
export const Route = createFileRoute("/api/version")({
	server: {
		handlers: {
			GET: async () => {
				await announceRelease();
				return Response.json(
					{ buildId: BUILD_ID },
					{ headers: { "cache-control": "no-store" } },
				);
			},
		},
	},
});
