import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChecklistFormDialog } from "#/components/checklists/checklist-form-dialog";
import { QuickAddTask } from "#/components/checklists/quick-add-task";
import { TaskRenameDialog } from "#/components/checklists/task-rename-dialog";
import { TaskRow } from "#/components/checklists/task-row";
import { CompletedSection } from "#/components/common/completed-section";
import { PaceLabel } from "#/components/common/pace-label";
import { ProgressMeter } from "#/components/common/progress-meter";
import { SortToggle } from "#/components/common/sort-toggle";
import { ErrorNotice, RowListSkeleton } from "#/components/common/states";
import { VelocityStats } from "#/components/common/velocity-stats";
import { TagFormDialog } from "#/components/tags/tag-form-dialog";
import { formatDate } from "#/lib/format-date";
import {
	type ChecklistValues,
	createTagResolver,
	queueAddRef,
	queueCreateTag,
	queueCreateTask,
	queueDeleteChecklist,
	queueDeleteTask,
	queueRemoveRef,
	queueUpdateChecklist,
	queueUpdateTask,
} from "#/lib/pending/actions";
import {
	overlayChecklistDetail,
	pendingChecklistDetail,
} from "#/lib/pending/overlay-checklists";
import { overlayTaskLists } from "#/lib/pending/overlay-lists";
import { overlayTags } from "#/lib/pending/overlay-tags";
import { usePendingChanges } from "#/lib/pending/store";
import { computeVelocity, elapsedFraction } from "#/lib/progress";
import type { ParsedTitle } from "#/lib/tags/inline-tags";
import { orderTasks, type SortOrder } from "#/lib/tasks/tasks";
import { checklistQuery } from "#/queries/checklists";
import { primeQuery } from "#/queries/prime";
import { tagsQuery } from "#/queries/tags";
import { taskListsQuery } from "#/queries/task-lists";
import type { Task } from "#/schemas/task";
import { SORT_ORDER_STEP, type TaskListName } from "#/schemas/task-list";

export const Route = createFileRoute("/checklists/$checklistId")({
	loader: ({ context, params }) =>
		Promise.all([
			primeQuery(context.queryClient, checklistQuery(params.checklistId)),
			// See the note in `today.tsx`: quick-add needs the tag list.
			primeQuery(context.queryClient, tagsQuery()),
		]),
	component: ChecklistDetailPage,
});

function ChecklistDetailPage() {
	const { checklistId } = Route.useParams();
	const navigate = useNavigate();
	const queued = usePendingChanges();

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

	// A checklist created a moment ago exists only in the queue, so there is
	// nothing to fetch: it is built from the queue instead.
	const detail = useMemo(
		() =>
			data
				? overlayChecklistDetail(data, queued)
				: pendingChecklistDetail(checklistId, queued),
		[data, queued, checklistId],
	);

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

	const tags = useMemo(
		() => overlayTags(tagsResult.data ?? [], queued),
		[tagsResult.data, queued],
	);

	const taskLists = useMemo(
		() =>
			lists.data
				? overlayTaskLists(lists.data, queued)
				: { today: [], backlog: [] },
		[lists.data, queued],
	);

	/** Which reference list each task in this checklist is on, if any. */
	const listStates = useMemo(() => {
		const states = new Map<string, TaskListName>();
		for (const list of ["today", "backlog"] as const) {
			for (const entry of taskLists[list]) {
				if (entry.item.checklistId === checklistId) {
					states.set(entry.item.taskId, list);
				}
			}
		}
		return states;
	}, [taskLists, checklistId]);

	/*
	 * Only wait when there is genuinely nothing to show.
	 *
	 * A checklist created a moment ago — the Inbox, most often — exists only in
	 * the queue until the next save, and the fetch for it is either in flight or
	 * about to fail. Waiting on that fetch would hide a checklist the browser can
	 * already draw in full, which is what made opening the Inbox show a skeleton
	 * that never resolved.
	 */
	if (detail === null) {
		return (
			<VStack gap={4}>
				<Link href="/checklists">Back to checklists</Link>
				{isError ? (
					<ErrorNotice error={error} onRetry={() => void refetch()} />
				) : (
					<Card padding={4}>
						<RowListSkeleton count={6} />
					</Card>
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
				onToggle: (completed) =>
					queueUpdateTask(checklistId, task, { completed }),
				onSetList: (list) => setList(task, list),
				onSetUrgent: (urgent) => queueUpdateTask(checklistId, task, { urgent }),
				onSetImportant: (important) =>
					queueUpdateTask(checklistId, task, { important }),
				onRename: () => setRenaming(task),
				onDelete: () => setPendingDelete(task),
			}}
		/>
	);

	/**
	 * Add a pasted block of tasks, tags and all.
	 *
	 * One resolver for the whole block, so a tag written on three lines is
	 * created once: the first two exist only in the queue, where `tags` from the
	 * server cannot see them.
	 */
	function addTasks(lines: Array<ParsedTitle>) {
		const resolveTag = createTagResolver(tags);

		for (const line of lines) {
			queueCreateTask({
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
				(candidate) =>
					candidate.item.checklistId === checklistId &&
					candidate.item.taskId === task.taskId,
			);
			if (entry) {
				queueRemoveRef({
					list: current,
					itemId: entry.item.itemId,
					title: task.title,
				});
			}
			return;
		}

		queueAddRef({
			list,
			checklistId,
			checklistTitle: detail?.title ?? "",
			task,
			sortOrder: (taskLists[list].length + 1) * SORT_ORDER_STEP,
		});
	}

	return (
		<VStack gap={4}>
			<Link href="/checklists">Back to checklists</Link>

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
					button={{ label: "Checklist actions", variant: "ghost" }}
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
			>
				{completed.map((task, index) => (
					<div
						key={task.taskId}
						className="thunderlist-row thunderlist-task-row"
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
						const resolveTag = createTagResolver(tags);
						queueUpdateTask(checklistId, renaming, {
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
					queueCreateTag(values);
					setIsCreatingTag(false);
				}}
			/>

			<ChecklistFormDialog
				isOpen={isEditOpen}
				onOpenChange={setIsEditOpen}
				checklist={detail}
				onSubmit={(values: ChecklistValues) => {
					queueUpdateChecklist(detail, values);
					setIsEditOpen(false);
				}}
			/>

			<AlertDialog
				isOpen={pendingDelete !== null}
				onOpenChange={(open) => {
					if (!open) setPendingDelete(null);
				}}
				title={`Delete "${pendingDelete?.title ?? ""}"?`}
				description="This task will be deleted when you save your changes."
				actionLabel="Delete"
				onAction={() => {
					if (pendingDelete) queueDeleteTask(checklistId, pendingDelete);
					setPendingDelete(null);
				}}
			/>

			<AlertDialog
				isOpen={isClearingCompleted}
				onOpenChange={setIsClearingCompleted}
				title={`Delete ${completed.length} completed ${completed.length === 1 ? "task" : "tasks"}?`}
				description="They will be deleted when you save your changes, along with any Today or Backlog entry pointing at them."
				actionLabel="Delete"
				onAction={() => {
					for (const task of completed) queueDeleteTask(checklistId, task);
					setIsClearingCompleted(false);
				}}
			/>

			<AlertDialog
				isOpen={isDeletingChecklist}
				onOpenChange={setIsDeletingChecklist}
				title={`Delete ${detail.title}?`}
				description="The checklist and all of its tasks will be deleted when you save your changes."
				actionLabel="Delete"
				onAction={() => {
					queueDeleteChecklist(detail);
					setIsDeletingChecklist(false);
					void navigate({ to: "/checklists" });
				}}
			/>
		</VStack>
	);
}
