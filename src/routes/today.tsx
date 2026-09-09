import { createFileRoute } from "@tanstack/react-router";
import { TaskListScreen } from "#/components/task-lists/task-list-screen";
import { formatDateWithWeekday } from "#/lib/format-date";
import { primeQuery } from "#/queries/prime";
import { tagsQuery } from "#/queries/tags";
import { taskListsQuery } from "#/queries/task-lists";
import { todayDateOnly } from "#/schemas/common";

export const Route = createFileRoute("/today")({
	loader: ({ context }) =>
		Promise.all([
			primeQuery(context.queryClient, taskListsQuery()),
			// Quick-add matches `#tags` against this list, so it has to be there
			// before anything can be typed — otherwise a tag that already exists
			// would be queued for creation a second time.
			primeQuery(context.queryClient, tagsQuery()),
		]),
	component: TodayPage,
});

function todayLabel(): string {
	return formatDateWithWeekday(todayDateOnly());
}

function TodayPage() {
	return (
		<TaskListScreen
			list="today"
			subtitle={todayLabel()}
			emptyTitle="No tasks planned for today."
			emptyDescription="Add a task from one of your checklists to plan your day."
		/>
	);
}
