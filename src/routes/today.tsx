import { createFileRoute } from "@tanstack/react-router";
import { TaskListScreen } from "#/components/task-lists/task-list-screen";
import { formatDateWithWeekday } from "#/lib/format-date";
import { deferQuery, primeQuery } from "#/queries/prime";
import { tagsQuery } from "#/queries/tags";
import { taskListsQuery } from "#/queries/task-lists";
import { todayDateOnly } from "#/schemas/common";

export const Route = createFileRoute("/today")({
	/** `?task=` names a task to scroll to and ring; see `useFocusTask`. */
	validateSearch: (search: Record<string, unknown>) => ({
		task: typeof search.task === "string" ? search.task : undefined,
	}),
	loader: ({ context }) => {
		// Quick-add matches `#tags` against this list, but nobody is typing on the
		// first frame — it is started here and arrives while the list is read.
		deferQuery(context.queryClient, tagsQuery());

		return primeQuery(context.queryClient, taskListsQuery());
	},
	component: TodayPage,
});

function todayLabel(): string {
	return formatDateWithWeekday(todayDateOnly());
}

function TodayPage() {
	const { task } = Route.useSearch();

	return (
		<TaskListScreen
			focusTaskId={task}
			list="today"
			subtitle={todayLabel()}
			emptyTitle="No tasks planned for today."
			emptyDescription="Add a task from one of your checklists to plan your day."
		/>
	);
}
