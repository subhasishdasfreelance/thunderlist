import { createFileRoute, redirect } from "@tanstack/react-router";
import { checklistsQuery } from "#/queries/checklists";
import { specialChecklist } from "#/schemas/checklist";

/**
 * The Backlog was a list, then a tag; it is a checklist now, at its own id.
 * The old address stays so a bookmark still lands on it.
 */
export const Route = createFileRoute("/backlog")({
	beforeLoad: async ({ context }) => {
		const backlog = specialChecklist(
			await context.queryClient.ensureQueryData(checklistsQuery()),
			"backlog",
		);

		if (backlog === null) throw redirect({ to: "/checklists" });
		throw redirect({
			to: "/checklists/$checklistId",
			params: { checklistId: backlog.checklistId },
			search: { task: undefined },
		});
	},
});
