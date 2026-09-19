import { FormDialog } from "#/components/common/form-dialog";
import { useSpace } from "#/lib/use-team";
import { TaskTypesEditor } from "./task-types-editor";

/**
 * The space's list of task types.
 *
 * The list lives on the Settings screen, beside the space it belongs to, and
 * this is what opens there. It opens from the type picker too, so a type that
 * is missing can be added while a task is being sorted rather than a screen
 * away.
 */
export function TaskTypesDialog({
	isOpen,
	onOpenChange,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}) {
	const team = useSpace()?.team ?? null;

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title="Task types"
			subtitle={`The kinds of work tasks in ${
				team === null ? "your own space" : team.name
			} are sorted into.`}
			width={560}
		>
			<TaskTypesEditor />
		</FormDialog>
	);
}
