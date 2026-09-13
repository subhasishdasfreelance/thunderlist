import { useTeam } from "#/lib/use-team";
import type { Task } from "#/schemas/task";
import { PeoplePickerDialog } from "./people-picker-dialog";

/**
 * Assign a task to people in the team, from its menu; Space on the row takes
 * it on yourself.
 *
 * A task can be anyone's, and more than one person's: people are picked, not
 * chosen between. The same picker says who can see a list; see
 * `PeoplePickerDialog`.
 */
export function AssignDialog({
	isOpen,
	onOpenChange,
	task,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	task: Pick<Task, "title" | "assignees"> | null;
	onSubmit: (assignees: Array<string>) => void;
}) {
	const team = useTeam();

	return (
		<PeoplePickerDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title="Assign"
			subtitle={task?.title}
			members={team?.members ?? []}
			value={task?.assignees ?? []}
			onSubmit={(chosen) => onSubmit(chosen ?? [])}
		/>
	);
}
