import { createFileRoute } from "@tanstack/react-router";
import { TaskListScreen } from "#/components/task-lists/task-list-screen";
import { deferQuery, primeQuery } from "#/queries/prime";
import { tagsQuery } from "#/queries/tags";
import { taskListsQuery } from "#/queries/task-lists";

export const Route = createFileRoute("/backlog")({
	/** `?task=` names a task to scroll to and ring; see `useFocusTask`. */
	validateSearch: (search: Record<string, unknown>) => ({
		task: typeof search.task === "string" ? search.task : undefined,
	}),
	loader: ({ context }) => {
		// See the note in `today.tsx`: quick-add needs the tags, but not yet.
		deferQuery(context.queryClient, tagsQuery());

		return primeQuery(context.queryClient, taskListsQuery());
	},
	component: BacklogPage,
});

function BacklogPage() {
	const { task } = Route.useSearch();

	return (
		<TaskListScreen
			focusTaskId={task}
			list="backlog"
			subtitle="Parked for later, out of the way of today."
			emptyTitle="Nothing in the backlog."
			emptyDescription="Park a task here to get it off Today without losing it."
		/>
	);
}
