import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { VStack } from "@astryxdesign/core/Stack";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { TaskRow } from "#/components/checklists/task-row";
import { ListPagination } from "#/components/common/list-pagination";
import { SelectionBar } from "#/components/tasks/selection-bar";
import { useTaskDialogs } from "#/components/tasks/task-dialogs";
import {
	applyBatched,
	moveAllToStage,
	moveManyToBacklog,
	moveToBacklog,
	setSpecialTag,
	toggleAssignee,
	toggleAssigneeOnAll,
	toggleFlagOnAll,
	toggleSpecialTagOnAll,
	updateTask,
	useApplyChange,
} from "#/lib/changes";
import type { useTaskSelection } from "#/lib/use-task-selection";
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
	selection,
}: {
	/** The page of tasks on show. */
	tasks: ReadonlyArray<TaggedTask>;
	page: number;
	/** How many there are across every page. */
	total: number;
	onPageChange: (page: number) => void;
	/** Each row names the stage it is at; see `TaskRow`. */
	isStageShown?: boolean;
	/**
	 * The rows picked out, kept by the screen so its Select all can reach
	 * them; see `useTaskSelection`.
	 */
	selection: ReturnType<typeof useTaskSelection>;
}) {
	const navigate = useNavigate();
	const { apply, applyAsync } = useApplyChange();
	const tagsResult = useQuery(tagsQuery());
	const checklistsResult = useQuery(checklistsQuery());
	const space = useSpace();
	const team = space?.team ?? null;
	const { canManageContent, canUpdateTasks } = usePermissions();

	const { picked, clear } = selection;

	const tags = tagsResult.data ?? [];
	const checklists = checklistsResult.data ?? [];
	// What its rows and the bar open over the list; see `useTaskDialogs`.
	const taskDialogs = useTaskDialogs({
		tags,
		canManageContent,
		onPickDone: clear,
	});
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
					onSetType: () => taskDialogs.setType([task]),
					onAddTag: () => taskDialogs.tag([task]),
					onRename: () => taskDialogs.rename(task),
					onMove: () => taskDialogs.move([task]),
					onDelete: () => taskDialogs.deleteOne(task),
					onAssign:
						team === null ? undefined : () => taskDialogs.assign([task]),
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
						canManageContent ? () => taskDialogs.move(pickedTasks) : undefined
					}
					onAddTag={() => taskDialogs.tag(pickedTasks)}
					onDelete={
						canManageContent
							? () =>
									taskDialogs.deleteMany(pickedTasks.map((task) => task.taskId))
							: undefined
					}
					onToggleToday={() =>
						toggleSpecialTagOnAll(apply, pickedTasks, "today", tags)
					}
					onToggleFocus={() =>
						toggleSpecialTagOnAll(apply, pickedTasks, "focus", tags)
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
					onSetType={() => taskDialogs.setType(pickedTasks)}
					onToggleMine={
						space?.team == null
							? undefined
							: () => toggleAssigneeOnAll(apply, pickedTasks, space.email)
					}
					onAssign={
						team === null ? undefined : () => taskDialogs.assign(pickedTasks)
					}
					onEdit={() =>
						pickedTasks.length === 1
							? taskDialogs.rename(pickedTasks[0])
							: taskDialogs.editMany(pickedTasks)
					}
					onClear={clear}
				/>
			)}

			{taskDialogs.dialogs}
		</>
	);
}
