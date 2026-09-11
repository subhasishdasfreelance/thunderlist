import { createFileRoute, redirect } from "@tanstack/react-router";

/** The Backlog is a tag now; see `today.tsx`, which this mirrors. */
export const Route = createFileRoute("/backlog")({
	beforeLoad: () => {
		throw redirect({
			to: "/tags/$tagId",
			params: { tagId: "backlog" },
			search: { task: undefined },
		});
	},
});
