import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Today was a screen of its own; it is a tag now, and its page is
 * `/tags/today`. The old address stays so a bookmark — or an installed app
 * that has not yet picked up its new start address — still lands there.
 */
export const Route = createFileRoute("/today")({
	beforeLoad: () => {
		throw redirect({
			to: "/tags/$tagId",
			params: { tagId: "today" },
			search: { task: undefined },
		});
	},
});
