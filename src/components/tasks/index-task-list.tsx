import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { VStack } from "@astryxdesign/core/Stack";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChecklistPickerDialog } from "#/components/checklists/checklist-picker-dialog";
import { TaskRenameDialog } from "#/components/checklists/task-rename-dialog";
import { TaskRow } from "#/components/checklists/task-row";
import { ListPagination } from "#/components/common/list-pagination";
import { TagTasks } from "#/components/tags/tag-tasks";
import { SelectionBar } from "#/components/tasks/selection-bar";
import { TaskTypeDialog } from "#/components/tasks/task-type-dialog";
import { TasksEditDialog } from "#/components/tasks/tasks-edit-dialog";
import { AssignDialog } from "#/components/teams/assign-dialog";
import {
	applyBatched,
	assignAlike,
	createTagResolver,
	moveAllToStage,
	moveManyToBacklog,
	moveToBacklog,
	resolveTags,
	setSpecialTag,
	setTypeOnAll,
	toggleAssignee,
	toggleAssigneeOnAll,
	toggleFlagOnAll,
	toggleSpecialTagOnAll,
	updateAllAlike,
	updateTask,
	useApplyChange,
} from "#/lib/changes";
import { shortTitle } from "#/lib/tasks/tasks";
import { useHeld } from "#/lib/use-held";
import { useTaskSelection } from "#/lib/use-task-selection";
import { usePermissions, useSpace } from "#/lib/use-team";
import { checklistsQuery } from "#/queries/checklists";
import type { TaggedTask } from "#/queries/system";
import { tagsQuery } from "#/queries/tags";
import {
	checklistStages,
	nextStageId,
	sharedStages,
	specialChecklist,
} from "#/schemas/checklist";

/**
 * A page of tasks from anywhere, each with the checklist it lives in, as full
 * rows: ticked, flagged, edited, moved and deleted right here, as on a
 * checklist's own page. The Priority, Across lists and Untagged screens list
 * this way.
 *
 * Several can be picked out at once by dragging across them, and moved on,
 * flagged, tagged, moved to a checklist or deleted together, in one change;
 * see `SelectionBar`.
 */
export function IndexTaskList({
	tasks,
	page,
	total,
	onPageChange,
	isStageShown = true,
}: {
	/** The page of tasks on show. */
	tasks: ReadonlyArray<TaggedTask>;
	page: number;
	/** How many there are across every page. */
	total: number;
	onPageChange: (page: number) => void;
	/** Each row names the stage it is at; see `TaskRow`. */
	isStageShown?: boolean;
}) {
	const navigate = useNavigate();
	const { apply, applyAsync } = useApplyChange();
	const tagsResult = useQuery(tagsQuery());
	const checklistsResult = useQuery(checklistsQuery());
	const space = useSpace();
	const team = space?.team ?? null;
	const { canManageContent, canUpdateTasks } = usePermissions();

	const [renaming, setRenaming] = useState<TaggedTask | null>(null);
	// Every task picked out, edited together; see `TasksEditDialog`.
	const [editingMany, setEditingMany] =
		useState<ReadonlyArray<TaggedTask> | null>(null);
	const [pendingDelete, setPendingDelete] = useState<TaggedTask | null>(null);
	// Its title stays on the question while it closes; see `useHeld`.
	const shownDelete = useHeld(pendingDelete);
	// The tasks being given to people: the one pointed at, or every one
	// picked out; see `AssignDialog`.
	const [assigning, setAssigning] = useState<ReadonlyArray<TaggedTask> | null>(
		null,
	);
	const [typing, setTyping] = useState<ReadonlyArray<TaggedTask> | null>(null);
	// The tasks a tag is being put on, moved or deleted: the one pointed at,
	// or every one picked out; see `SelectionBar`.
	const [tagging, setTagging] = useState<ReadonlyArray<TaggedTask> | null>(
		null,
	);
	const [moving, setMoving] = useState<ReadonlyArray<TaggedTask> | null>(null);
	const [deleting, setDeleting] = useState<ReadonlyArray<TaggedTask> | null>(
		null,
	);
	const shownDeleting = useHeld(deleting);
	const { picked, clear } = useTaskSelection();

	const tags = tagsResult.data ?? [];
	const checklists = checklistsResult.data ?? [];
	// Somewhere to park a task; see `moveToBacklog`.
	const backlog = specialChecklist(checklists, "backlog");

	/** Where a task lives, and the stages it goes through there. */
	const stagesFor = (checklistId: string | null) =>
		checklistStages(
			checklists.find((checklist) => checklist.checklistId === checklistId) ??
				{},
		);

	// Only someone who can move a task on has anything to do with a pick.
	const pickedTasks = canUpdateTasks
		? tasks.filter((task) => picked.has(task.taskId))
		: [];
	const isFinishable = (task: TaggedTask) =>
		!task.completed && task.trackerId == null && task.linkedChecklistId == null;

	/** Every picked task on to the next stage of its own checklist. */
	function moveOn() {
		applyBatched(apply, (collect) => {
			for (const task of pickedTasks) {
				const next = nextStageId(task, stagesFor(task.checklistId));
				if (next !== null) updateTask(collect, task.taskId, { stageId: next });
			}
		});
		clear();
	}

	// The stages to move them to, where every one's checklist has the same.
	const pickedStages =
		sharedStages(pickedTasks.map((task) => stagesFor(task.checklistId))) ??
		undefined;

	/** Every picked task to one stage of its checklist's; see `sharedStages`. */
	function moveTo(target: string) {
		moveAllToStage(
			apply,
			pickedTasks.map((task) => ({
				task,
				stages: stagesFor(task.checklistId),
			})),
			target,
		);
		clear();
	}

	/** Every picked task done that can be made done by hand. */
	function finish() {
		applyBatched(apply, (collect) => {
			for (const task of pickedTasks) {
				if (isFinishable(task)) {
					updateTask(collect, task.taskId, { completed: true });
				}
			}
		});
		clear();
	}

	/** Every picked task parked, but those in the Backlog already. */
	const parkable =
		backlog === null || !canManageContent
			? []
			: pickedTasks.filter((task) => task.checklistId !== backlog.checklistId);

	/** One task, as a tag's page draws it. */
	const taskRow = (task: TaggedTask) => {
		const { checklistId } = task;

		return (
			<TaskRow
				task={task}
				tags={tags}
				stages={stagesFor(checklistId)}
				isStageShown={isStageShown}
				backlog={
					backlog === null || checklistId === backlog.checklistId
						? undefined
						: {
								title: backlog.title,
								onMove: () =>
									void moveToBacklog(
										applyAsync,
										task,
										backlog.checklistId,
										tags,
									),
							}
				}
				checklist={
					checklistId === null
						? null
						: {
								title: task.checklistTitle,
								isBacklog: checklistId === backlog?.checklistId,
								// Straight to the task, not just the checklist it lives in.
								onOpen: () =>
									void navigate({
										to: "/checklists/$checklistId",
										params: { checklistId },
										search: { task: task.taskId },
									}),
							}
				}
				actions={{
					onToggle: (completed) =>
						updateTask(apply, task.taskId, { completed }),
					onSetStage: (stageId) => updateTask(apply, task.taskId, { stageId }),
					onSetSpecial: (kind, isOn) =>
						setSpecialTag(apply, task, kind, isOn, tags),
					onSetUrgent: (urgent) => updateTask(apply, task.taskId, { urgent }),
					onSetImportant: (important) =>
						updateTask(apply, task.taskId, { important }),
					onSetType: () => setTyping([task]),
					onAddTag: () => setTagging([task]),
					onRename: () => setRenaming(task),
					onMove: () => setMoving([task]),
					onDelete: () => setPendingDelete(task),
					onAssign: team === null ? undefined : () => setAssigning([task]),
					onToggleMine:
						space?.team == null
							? undefined
							: () => toggleAssignee(apply, task, space.email),
				}}
			/>
		);
	};

	return (
		<>
			<Card padding={0}>
				<VStack gap={0} paddingBlock={2}>
					{tasks.map((task, position) => (
						<div
							key={task.taskId}
							className="thunderlist-row thunderlist-task-row"
							data-task-id={task.taskId}
							data-picked={picked.has(task.taskId) && canUpdateTasks}
						>
							{position === 0 ? null : <Divider />}
							{taskRow(task)}
						</div>
					))}
					<ListPagination page={page} total={total} onChange={onPageChange} />
				</VStack>
			</Card>

			{pickedTasks.length === 0 ? null : (
				<SelectionBar
					count={pickedTasks.length}
					onNextStage={
						pickedTasks.some(
							(task) => nextStageId(task, stagesFor(task.checklistId)) !== null,
						)
							? moveOn
							: undefined
					}
					stages={pickedStages}
					onMoveTo={moveTo}
					onDone={pickedTasks.some(isFinishable) ? finish : undefined}
					onMoveToChecklist={
						canManageContent ? () => setMoving(pickedTasks) : undefined
					}
					onAddTag={() => setTagging(pickedTasks)}
					onDelete={
						canManageContent ? () => setDeleting(pickedTasks) : undefined
					}
					onToggleToday={() =>
						toggleSpecialTagOnAll(apply, pickedTasks, "today", tags)
					}
					onBacklog={
						backlog === null || parkable.length === 0
							? undefined
							: () => {
									moveManyToBacklog(apply, parkable, backlog.checklistId, tags);
									clear();
								}
					}
					onToggleUrgent={() => toggleFlagOnAll(apply, pickedTasks, "urgent")}
					onToggleImportant={() =>
						toggleFlagOnAll(apply, pickedTasks, "important")
					}
					onSetType={() => setTyping(pickedTasks)}
					onToggleMine={
						space?.team == null
							? undefined
							: () => toggleAssigneeOnAll(apply, pickedTasks, space.email)
					}
					onAssign={team === null ? undefined : () => setAssigning(pickedTasks)}
					onEdit={() =>
						pickedTasks.length === 1
							? setRenaming(pickedTasks[0])
							: setEditingMany(pickedTasks)
					}
					onClear={clear}
				/>
			)}

			<AssignDialog
				isOpen={assigning !== null}
				onOpenChange={(open) => {
					if (!open) setAssigning(null);
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
				onOpenChange={(open) => {
					if (!open) setTyping(null);
				}}
				tasks={typing}
				onPick={(typeId) => {
					if (typing) setTypeOnAll(apply, typing, typeId);
					setTyping(null);
				}}
			/>

			<ChecklistPickerDialog
				isOpen={moving !== null}
				onOpenChange={(open) => {
					if (!open) setMoving(null);
				}}
				title="Move to checklist"
				subtitle={
					moving === null
						? undefined
						: moving.length === 1
							? moving[0].title
							: `${moving.length} tasks`
				}
				// Every checklist but the one they are all already in.
				checklists={checklists.filter(
					(checklist) =>
						!(moving ?? []).every(
							(task) => task.checklistId === checklist.checklistId,
						),
				)}
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
					clear();
				}}
			/>

			<TaskRenameDialog
				isOpen={renaming !== null}
				onOpenChange={(open) => {
					if (!open) setRenaming(null);
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
				onOpenChange={(open) => {
					if (!open) setPendingDelete(null);
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
				isOpen={deleting !== null}
				onOpenChange={(open) => {
					if (!open) setDeleting(null);
				}}
				title={`Delete ${shownDeleting?.length ?? 0} tasks?`}
				description="Every task picked out will be deleted."
				actionLabel="Delete"
				onAction={() => {
					if (deleting) {
						apply({
							kind: "task.deleteMany",
							taskIds: deleting.map((task) => task.taskId),
						});
					}
					setDeleting(null);
					clear();
				}}
			/>
		</>
	);
}
