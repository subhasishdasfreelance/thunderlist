import { createFileRoute } from "@tanstack/react-router";
import { TaskListScreen } from "#/components/task-lists/task-list-screen";
import { primeQuery } from "#/queries/prime";
import { tagsQuery } from "#/queries/tags";
import { taskListsQuery } from "#/queries/task-lists";

export const Route = createFileRoute("/backlog")({
	loader: ({ context }) =>
		Promise.all([
			primeQuery(context.queryClient, taskListsQuery()),
			// See the note in `today.tsx`: quick-add needs the tag list.
			primeQuery(context.queryClient, tagsQuery()),
		]),
	component: BacklogPage,
});

function BacklogPage() {
	return (
		<TaskListScreen
			list="backlog"
			subtitle="Parked for later, out of the way of today."
			emptyTitle="Nothing in the backlog."
			emptyDescription="Park a task here to get it off Today without losing it."
		/>
	);
}
