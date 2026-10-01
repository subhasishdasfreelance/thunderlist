import { useMemo } from "react";
import { sharedAssignees } from "#/lib/tasks/tasks";
import { useTeam } from "#/lib/use-team";
import type { Task } from "#/schemas/task";
import { PeoplePickerDialog } from "./people-picker-dialog";

/**
 * Assign a task to people in the team, from its menu; Space on the row takes
 * it on yourself. Or every task picked out, from the bar over them: those
 * ticked are on all of them; see `assignAlike`.
 *
 * A task can be anyone's, and more than one person's: people are picked, not
 * chosen between. The same picker says who can see a list; see
 * `PeoplePickerDialog`.
 */
export function AssignDialog({
	isOpen,
	onOpenChange,
	tasks,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** The tasks being assigned, or `null` while none are. */
	tasks: ReadonlyArray<Pick<Task, "title" | "assignees">> | null;
	onSubmit: (assignees: Array<string>) => void;
}) {
	const team = useTeam();
	// The same list for the same tasks: the picker starts afresh whenever it
	// changes, which would undo every tick.
	const shared = useMemo(() => sharedAssignees(tasks), [tasks]);

	return (
		<PeoplePickerDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title="Assign"
			subtitle={
				tasks?.length === 1 ? tasks[0].title : `${tasks?.length ?? 0} tasks`
			}
			members={team?.members ?? []}
			value={shared}
			onSubmit={(chosen) => onSubmit(chosen ?? [])}
		/>
	);
}
