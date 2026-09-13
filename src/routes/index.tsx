import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Thunderlist opens straight into the app, on Today — a tag, whose page is at
 * the same address in every account; see `tagParam`.
 */
export const Route = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({
			to: "/tags/$tagId",
			params: { tagId: "today" },
			search: { task: undefined },
		});
	},
});
