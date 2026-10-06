import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { ChecklistPickerDialog } from "#/components/checklists/checklist-picker-dialog";
import { TaskRenameDialog } from "#/components/checklists/task-rename-dialog";
import { TagTasks } from "#/components/tags/tag-tasks";
import { TaskTypeDialog } from "#/components/tasks/task-type-dialog";
import { TasksEditDialog } from "#/components/tasks/tasks-edit-dialog";
import { AssignDialog } from "#/components/teams/assign-dialog";
import {
	applyBatched,
	assignAlike,
	createTagResolver,
	resolveTags,
	setTypeOnAll,
	updateAllAlike,
	updateTask,
	useApplyChange,
} from "#/lib/changes";
import { shortTitle } from "#/lib/tasks/tasks";
import { useHeld } from "#/lib/use-held";
import { checklistsQuery } from "#/queries/checklists";
import type { Tag } from "#/schemas/tag";
import type { Task } from "#/schemas/task";

/** A task being moved, with the checklist it is in now, if any. */
type Moving = Pick<Task, "taskId" | "title"> & { checklistId: string | null };

/**
 * The dialogs a list of tasks opens over itself — edit one, edit several,
 * assign, type, tag, move to a checklist, delete one or several — with what
 * each is open on. Every screen of task rows offers the same ones, so they
 * are kept here once; the screen opens them from its rows and its
 * `SelectionBar`, and draws `dialogs` beside them.
 *
 * `onPickDone` lets go of the pick once a move or a delete has used it up.
 */
export function useTaskDialogs({
	tags,
	canManageContent,
	onPickDone,
}: {
	/** Every tag there is, for the title's `#tags` and for tagging. */
	tags: ReadonlyArray<Tag>;
	/** Whether a name matching no tag may become one; see `Capability`. */
	canManageContent: boolean;
	onPickDone: () => void;
}): {
	rename: (task: Task) => void;
	editMany: (tasks: ReadonlyArray<Task>) => void;
	assign: (tasks: ReadonlyArray<Task>) => void;
	setType: (tasks: ReadonlyArray<Task>) => void;
	tag: (tasks: ReadonlyArray<Task>) => void;
	move: (tasks: ReadonlyArray<Moving>) => void;
	deleteOne: (task: Task) => void;
	deleteMany: (taskIds: ReadonlyArray<string>) => void;
	dialogs: ReactNode;
} {
	const { apply } = useApplyChange();
	const checklistsResult = useQuery(checklistsQuery());
	const checklists = checklistsResult.data ?? [];

	const [renaming, setRenaming] = useState<Task | null>(null);
	// Every task picked out, edited together; see `TasksEditDialog`.
	const [editingMany, setEditingMany] = useState<ReadonlyArray<Task> | null>(
		null,
	);
	// The tasks being given to people, a type or a tag, or moved: the one
	// pointed at, or every one picked out.
	const [assigning, setAssigning] = useState<ReadonlyArray<Task> | null>(null);
	const [typing, setTyping] = useState<ReadonlyArray<Task> | null>(null);
	const [tagging, setTagging] = useState<ReadonlyArray<Task> | null>(null);
	const [moving, setMoving] = useState<ReadonlyArray<Moving> | null>(null);
	const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
	const [deletingMany, setDeletingMany] =
		useState<ReadonlyArray<string> | null>(null);
	// Each question keeps its words while it closes; see `useHeld`.
	const shownDelete = useHeld(pendingDelete);
	const shownDeletingMany = useHeld(deletingMany);

	/*
	 * Where the tasks being moved can go: every checklist but the one they are
	 * all already in. Tasks from several checklists can go to any of them,
	 * and each that is there already stays.
	 */
	const moveTargets =
		moving === null
			? checklists
			: checklists.filter(
					(checklist) =>
						!moving.every((task) => task.checklistId === checklist.checklistId),
				);

	const dialogs = (
		<>
			<AssignDialog
				isOpen={assigning !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setAssigning(null);
				}}
				tasks={assigning}
				onSubmit={(assignees) => {
					if (assigning) assignAlike(apply, assigning, assignees);
					setAssigning(null);
				}}
			/>

			<TagTasks
				tasks={tagging}
				tags={tags}
				canCreate={canManageContent}
				onClose={() => setTagging(null)}
			/>

			<TasksEditDialog
				isOpen={editingMany !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setEditingMany(null);
				}}
				tasks={editingMany}
				onSave={(edit) => {
					if (editingMany) updateAllAlike(apply, editingMany, edit);
					setEditingMany(null);
				}}
			/>

			<TaskTypeDialog
				isOpen={typing !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setTyping(null);
				}}
				tasks={typing}
				onPick={(typeId) => {
					if (typing) setTypeOnAll(apply, typing, typeId);
					setTyping(null);
				}}
			/>

			<ChecklistPickerDialog
				isOpen={moving !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setMoving(null);
				}}
				title="Move to checklist"
				subtitle={
					moving === null
						? undefined
						: moving.length === 1
							? moving[0].title
							: `${moving.length} tasks`
				}
				checklists={moveTargets}
				isLoading={checklistsResult.isPending}
				onPick={(target) => {
					applyBatched(apply, (collect) => {
						for (const task of moving ?? []) {
							if (task.checklistId === target) continue;
							collect({
								kind: "task.move",
								taskId: task.taskId,
								checklistId: target,
							});
						}
					});
					setMoving(null);
					onPickDone();
				}}
			/>

			<TaskRenameDialog
				isOpen={renaming !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setRenaming(null);
				}}
				task={renaming}
				tags={tags}
				onSubmit={(parsed, details) => {
					if (renaming) {
						const resolveTag = createTagResolver(apply, tags, canManageContent);
						updateTask(apply, renaming.taskId, {
							title: parsed.title,
							tagIds: resolveTags(resolveTag, parsed.tagNames),
							...details,
						});
					}
					setRenaming(null);
				}}
			/>

			<AlertDialog
				isOpen={pendingDelete !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setPendingDelete(null);
				}}
				title={`Delete "${shortTitle(shownDelete?.title ?? "")}"?`}
				description="This task will be deleted."
				actionLabel="Delete"
				onAction={() => {
					if (pendingDelete) {
						apply({ kind: "task.delete", taskId: pendingDelete.taskId });
					}
					setPendingDelete(null);
				}}
			/>

			<AlertDialog
				isOpen={deletingMany !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setDeletingMany(null);
				}}
				title={`Delete ${shownDeletingMany?.length ?? 0} tasks?`}
				description="Every task picked out will be deleted."
				actionLabel="Delete"
				onAction={() => {
					if (deletingMany) {
						apply({ kind: "task.deleteMany", taskIds: [...deletingMany] });
					}
					setDeletingMany(null);
					onPickDone();
				}}
			/>
		</>
	);

	return {
		rename: setRenaming,
		editMany: setEditingMany,
		assign: setAssigning,
		setType: setTyping,
		tag: setTagging,
		move: setMoving,
		deleteOne: setPendingDelete,
		deleteMany: setDeletingMany,
		dialogs,
	};
}
