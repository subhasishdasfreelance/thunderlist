import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { ChecklistFormDialog } from "#/components/checklists/checklist-form-dialog";
import { QuickAddTask } from "#/components/checklists/quick-add-task";
import { TaskRenameDialog } from "#/components/checklists/task-rename-dialog";
import { TaskRow } from "#/components/checklists/task-row";
import { BackButton } from "#/components/common/back-button";
import { CompletedSection } from "#/components/common/completed-section";
import { LoadingState } from "#/components/common/loading-state";
import { PaceLabel } from "#/components/common/pace-label";
import { ProgressChart } from "#/components/common/progress-chart";
import { ProgressMeter } from "#/components/common/progress-meter";
import { SortToggle } from "#/components/common/sort-toggle";
import { ErrorNotice } from "#/components/common/states";
import { VelocityStats } from "#/components/common/velocity-stats";
import { TagFormDialog } from "#/components/tags/tag-form-dialog";
import {
	addTaskRef,
	type ChecklistValues,
	createTag,
	createTagResolver,
	createTask,
	updateTask,
	useApplyChange,
} from "#/lib/changes";
import { completionPoints, dayStart } from "#/lib/chart-points";
import { formatDate } from "#/lib/format-date";
import { computeVelocity, elapsedFraction } from "#/lib/progress";
import type { ParsedTitle } from "#/lib/tags/inline-tags";
import { orderTasks, type SortOrder } from "#/lib/tasks/tasks";
import { useFocusTask } from "#/lib/use-focus-task";
import { checklistQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { tagsQuery } from "#/queries/tags";
import { taskListsQuery } from "#/queries/task-lists";
import type { Task } from "#/schemas/task";
import { SORT_ORDER_STEP, type TaskListName } from "#/schemas/task-list";

export const Route = createFileRoute("/checklists/$checklistId")({
	/**
	 * `?task=` names a task to bring into view.
	 *
	 * Arriving from Today, the useful thing is not the checklist but the task you
	 * were just looking at, which may be well down a long list. Keeping it in the
	 * URL rather than in memory means the trip survives a reload and a shared
	 * link lands in the same place.
	 */
	validateSearch: (search: Record<string, unknown>) => ({
		task: typeof search.task === "string" ? search.task : undefined,
	}),
	loader: ({ context, params }) => {
		// See the note in `today.tsx`: quick-add needs the tags, but not yet. The
		// lists say which tasks are on Today, which is a badge on a row.
		deferQuery(context.queryClient, tagsQuery());
		deferQuery(context.queryClient, taskListsQuery());

		return primeQuery(context.queryClient, checklistQuery(params.checklistId));
	},
	component: ChecklistDetailPage,
});

function ChecklistDetailPage() {
	const { checklistId } = Route.useParams();
	const { task: focusTaskId } = Route.useSearch();
	const navigate = useNavigate();
	const { apply } = useApplyChange();

	const [renaming, setRenaming] = useState<Task | null>(null);
	const [isCreatingTag, setIsCreatingTag] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
	const [isDeletingChecklist, setIsDeletingChecklist] = useState(false);
	const [isClearingCompleted, setIsClearingCompleted] = useState(false);
	const [sort, setSort] = useState<SortOrder>("newest");

	const { data, isError, error, refetch } = useQuery(
		checklistQuery(checklistId),
	);
	const lists = useQuery(taskListsQuery());
	const tagsResult = useQuery(tagsQuery());

	const detail = data ?? null;

	const rows = useMemo(
		() => (detail ? orderTasks(detail.tasks, sort) : []),
		[detail, sort],
	);

	// Done work sits below what is still to do, under its own heading.
	const open = useMemo(() => rows.filter((task) => !task.completed), [rows]);
	const completed = useMemo(
		() => rows.filter((task) => task.completed),
		[rows],
	);

	const tags = tagsResult.data ?? [];

	const taskLists = lists.data ?? { today: [], backlog: [] };

	useFocusTask(focusTaskId);

	/** Which reference list each task is on, if any. */
	const listStates = useMemo(() => {
		const states = new Map<string, TaskListName>();
		for (const list of ["today", "backlog"] as const) {
			for (const entry of taskLists[list]) {
				states.set(entry.item.taskId, list);
			}
		}
		return states;
	}, [taskLists]);

	if (detail === null) {
		return (
			<VStack gap={4}>
				<BackButton to="/checklists" label="Checklists" />
				{isError ? (
					<ErrorNotice error={error} onRetry={() => void refetch()} />
				) : (
					<LoadingState />
				)}
			</VStack>
		);
	}

	/** One task row, used by both the open and the completed sections. */
	const taskRow = (task: Task) => (
		<TaskRow
			task={task}
			listState={listStates.get(task.taskId) ?? null}
			tags={tags}
			actions={{
				onToggle: (completed) => updateTask(apply, task.taskId, { completed }),
				onSetList: (list) => setList(task, list),
				onSetUrgent: (urgent) => updateTask(apply, task.taskId, { urgent }),
				onSetImportant: (important) =>
					updateTask(apply, task.taskId, { important }),
				onRename: () => setRenaming(task),
				onDelete: () => setPendingDelete(task),
			}}
		/>
	);

	/**
	 * Add a pasted block of tasks, tags and all.
	 *
	 * One resolver for the whole block, so a tag written on three lines is
	 * created once rather than three times.
	 */
	function addTasks(lines: Array<ParsedTitle>) {
		const resolveTag = createTagResolver(apply, tags);

		for (const line of lines) {
			createTask(apply, {
				checklistId,
				title: line.title,
				tagIds: line.tagNames.map(resolveTag),
			});
		}
	}

	const { progress } = detail;
	const elapsed = elapsedFraction({
		startDate: detail.startDate,
		deadline: detail.deadline,
	});

	const velocity = computeVelocity({
		startDate: detail.startDate,
		deadline: detail.deadline,
		current: progress.completed,
		target: progress.total,
	});

	function setList(task: Task, list: TaskListName | null) {
		if (list === null) {
			const current = listStates.get(task.taskId);
			if (!current) return;

			const entry = taskLists[current].find(
				(candidate) => candidate.item.taskId === task.taskId,
			);
			if (entry) {
				apply({
					kind: "ref.remove",
					list: current,
					itemId: entry.item.itemId,
				});
			}
			return;
		}

		addTaskRef(apply, {
			list,
			taskId: task.taskId,
			sortOrder: (taskLists[list].length + 1) * SORT_ORDER_STEP,
		});
	}

	return (
		<VStack gap={4}>
			<BackButton to="/checklists" label="Checklists" />

			<HStack gap={2} hAlign="between" vAlign="start">
				<VStack gap={0.5}>
					<Heading level={1}>{detail.title}</Heading>
					{detail.description === "" ? null : (
						<Text color="secondary">{detail.description}</Text>
					)}
				</VStack>

				<DropdownMenu
					hasChevron={false}
					placement="below"
					alignment="end"
					button={{
						label: "Checklist actions",
						tooltip: "Checklist actions",
						variant: "ghost",
						isIconOnly: true,
						icon: <MoreHorizontal aria-hidden />,
					}}
					items={[
						{ label: "Edit checklist", onClick: () => setIsEditOpen(true) },
						{
							label: "Delete checklist",
							variant: "destructive" as const,
							onClick: () => setIsDeletingChecklist(true),
						},
					]}
				/>
			</HStack>

			<Card padding={3}>
				<VStack gap={2}>
					<HStack gap={2} hAlign="between" vAlign="center">
						<Text weight="medium">{progress.percent}% complete</Text>
						<PaceLabel status={detail.status} />
					</HStack>
					<ProgressMeter
						label={`${detail.title} progress`}
						percent={progress.percent}
						expectedPercent={elapsed === null ? null : elapsed * 100}
						footnote={`${progress.completed} / ${progress.total} ${
							progress.total === 1 ? "task" : "tasks"
						}${detail.deadline ? ` · due ${formatDate(detail.deadline)}` : ""}`}
					/>
				</VStack>
			</Card>

			<VelocityStats
				startDate={detail.startDate}
				velocity={velocity}
				unit="tasks"
				isComplete={progress.total > 0 && progress.completed >= progress.total}
			/>

			<QuickAddTask tags={tags} onAdd={addTasks} />

			{open.length === 0 ? null : (
				<HStack gap={2} hAlign="between" vAlign="center">
					<Text type="label" weight="semibold" color="secondary">
						{open.length} to do
					</Text>
					<SortToggle order={sort} onChange={setSort} />
				</HStack>
			)}

			{rows.length === 0 ? (
				<EmptyState
					title="No tasks yet."
					description="Type above to add the first one. Tag it inline with #."
				/>
			) : open.length === 0 ? (
				<EmptyState
					title="All done."
					description="Everything here is complete."
				/>
			) : (
				<Card padding={0}>
					<VStack gap={0} paddingInline={4} paddingBlock={2}>
						{open.map((task, index) => (
							<div
								key={task.taskId}
								className="thunderlist-row thunderlist-task-row"
								data-task-id={task.taskId}
								data-focused={task.taskId === focusTaskId}
							>
								{index === 0 ? null : <Divider />}
								{taskRow(task)}
							</div>
						))}
					</VStack>
				</Card>
			)}

			<CompletedSection
				count={completed.length}
				clearLabel="Delete all completed"
				onClear={() => setIsClearingCompleted(true)}
				chart={
					<ProgressChart
						start={dayStart(detail.startDate)}
						end={detail.deadline === null ? null : dayStart(detail.deadline)}
						now={Date.now()}
						target={detail.progress.total}
						current={detail.progress.completed}
						points={completionPoints(detail.tasks, dayStart(detail.startDate))}
						startLabel={formatDate(detail.startDate)}
						endLabel={
							detail.deadline === null
								? "No deadline"
								: formatDate(detail.deadline)
						}
						summary={`${detail.progress.completed} of ${detail.progress.total} tasks done since ${formatDate(detail.startDate)}`}
					/>
				}
			>
				{completed.map((task, index) => (
					<div
						key={task.taskId}
						className="thunderlist-row thunderlist-task-row"
						data-task-id={task.taskId}
						data-focused={task.taskId === focusTaskId}
					>
						{index === 0 ? null : <Divider />}
						{taskRow(task)}
					</div>
				))}
			</CompletedSection>

			<TaskRenameDialog
				isOpen={renaming !== null}
				onOpenChange={(open) => {
					if (!open) setRenaming(null);
				}}
				task={renaming}
				tags={tags}
				onSubmit={(parsed) => {
					if (renaming) {
						const resolveTag = createTagResolver(apply, tags);
						updateTask(apply, renaming.taskId, {
							title: parsed.title,
							tagIds: parsed.tagNames.map(resolveTag),
						});
					}
					setRenaming(null);
				}}
			/>

			<TagFormDialog
				isOpen={isCreatingTag}
				onOpenChange={setIsCreatingTag}
				existingNames={tags.map((tag) => tag.name)}
				onSubmit={(values) => {
					createTag(apply, values);
					setIsCreatingTag(false);
				}}
			/>

			<ChecklistFormDialog
				isOpen={isEditOpen}
				onOpenChange={setIsEditOpen}
				checklist={detail}
				onSubmit={(values: ChecklistValues) => {
					apply({ kind: "checklist.update", checklistId, patch: values });
					setIsEditOpen(false);
				}}
			/>

			<AlertDialog
				isOpen={pendingDelete !== null}
				onOpenChange={(open) => {
					if (!open) setPendingDelete(null);
				}}
				title={`Delete "${pendingDelete?.title ?? ""}"?`}
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
				isOpen={isClearingCompleted}
				onOpenChange={setIsClearingCompleted}
				title={`Delete ${completed.length} completed ${completed.length === 1 ? "task" : "tasks"}?`}
				description="They will be deleted, along with any Today or Backlog entry pointing at them."
				actionLabel="Delete"
				onAction={() => {
					for (const task of completed) {
						apply({ kind: "task.delete", taskId: task.taskId });
					}
					setIsClearingCompleted(false);
				}}
			/>

			<AlertDialog
				isOpen={isDeletingChecklist}
				onOpenChange={setIsDeletingChecklist}
				title={`Delete ${detail.title}?`}
				description="The checklist and all of its tasks will be deleted."
				actionLabel="Delete"
				onAction={() => {
					apply({ kind: "checklist.delete", checklistId });
					setIsDeletingChecklist(false);
					void navigate({ to: "/checklists" });
				}}
			/>
		</VStack>
	);
}
