import { FormDialog } from "#/components/common/form-dialog";
import { useSpace } from "#/lib/use-team";
import { TaskTypesEditor } from "./task-types-editor";

/**
 * The space's list of task types, opened from where a type is picked.
 *
 * Types are about tasks, so they are managed beside them rather than among the
 * settings that are about the person signed in.
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
