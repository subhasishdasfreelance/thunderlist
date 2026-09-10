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
import { TaskRenameDialog } from "#/components/checklists/task-rename-dialog";
import { TaskRow } from "#/components/checklists/task-row";
import { BackButton } from "#/components/common/back-button";
import { CompletedSection } from "#/components/common/completed-section";
import { LoadingState } from "#/components/common/loading-state";
import { PaceLabel } from "#/components/common/pace-label";
import { ProgressChart } from "#/components/common/progress-chart";
import { ProgressMeter } from "#/components/common/progress-meter";
import { ShowMore } from "#/components/common/show-more";
import { SortToggle } from "#/components/common/sort-toggle";
import { ErrorNotice } from "#/components/common/states";
import { VelocityStats } from "#/components/common/velocity-stats";
import { TagFormDialog } from "#/components/tags/tag-form-dialog";
import {
	addTaskRef,
	createTagResolver,
	updateTask,
	useApplyChange,
} from "#/lib/changes";
import { completionPoints, dayStart } from "#/lib/chart-points";
import { formatDate } from "#/lib/format-date";
import { computeVelocity, elapsedFraction } from "#/lib/progress";
import { compareTasks, type SortOrder, sortTasksBy } from "#/lib/tasks/tasks";
import { useShowMore } from "#/lib/use-show-more";
import { deferQuery, primeQuery } from "#/queries/prime";
import { tagQuery, tagsQuery } from "#/queries/tags";
import { taskListsQuery } from "#/queries/task-lists";
import { type TagTaskEntry, tagStartDate } from "#/schemas/tag";
import type { Task } from "#/schemas/task";
import { SORT_ORDER_STEP, type TaskListName } from "#/schemas/task-list";

export const Route = createFileRoute("/tags/$tagId")({
	loader: ({ context, params }) => {
		// Every tag, for the highlights in the titles and the name check when
		// editing; the lists, for the Today badge on a row. Neither is waited for.
		deferQuery(context.queryClient, tagsQuery());
		deferQuery(context.queryClient, taskListsQuery());

		return primeQuery(context.queryClient, tagQuery(params.tagId));
	},
	component: TagDetailPage,
});

/**
 * One tag, read the way a checklist is.
 *
 * Progress against the tag's own dates, the speed figures, what is left to do
 * and what is done, as a list or a graph. The difference is where the tasks
 * come from: a tag gathers them from any number of checklists, and from none,
 * so every row names the checklist its task lives in and takes you there.
 *
 * There is no quick-add. A task needs a home, and a tag is not one.
 */
function TagDetailPage() {
	const { tagId } = Route.useParams();
	const navigate = useNavigate();
	const { apply } = useApplyChange();

	const [renaming, setRenaming] = useState<Task | null>(null);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
	const [isDeletingTag, setIsDeletingTag] = useState(false);
	const [isClearingCompleted, setIsClearingCompleted] = useState(false);
	const [sort, setSort] = useState<SortOrder>("newest");

	const { data, isError, error, refetch } = useQuery(tagQuery(tagId));
	const lists = useQuery(taskListsQuery());
	const tagsResult = useQuery(tagsQuery());

	const detail = data ?? null;

	const rows = useMemo(
		() =>
			detail
				? sortTasksBy(
						detail.tasks.map((entry) => ({
							entry,
							urgent: entry.task.urgent,
							important: entry.task.important,
						})),
						sort,
						(a, b) => compareTasks(a.entry.task, b.entry.task),
					).map((row) => row.entry)
				: [],
		[detail, sort],
	);

	// Done work sits below what is still to do, under its own heading.
	const open = useMemo(
		() => rows.filter((entry) => !entry.task.completed),
		[rows],
	);
	const completed = useMemo(
		() => rows.filter((entry) => entry.task.completed),
		[rows],
	);

	const openPaging = useShowMore(open);
	const completedPaging = useShowMore(completed);

	const tags = tagsResult.data ?? [];
	const taskLists = lists.data ?? { today: [], backlog: [] };

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
				<BackButton to="/tags" label="Tags" />
				{isError ? (
					<ErrorNotice error={error} onRetry={() => void refetch()} />
				) : (
					<LoadingState />
				)}
			</VStack>
		);
	}

	const { progress } = detail;
	const startDate = tagStartDate(detail);
	const elapsed = elapsedFraction({ startDate, deadline: detail.deadline });

	const velocity = computeVelocity({
		startDate,
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

	/** One task row, used by both the open and the completed sections. */
	const taskRow = ({ task, checklistId, checklistTitle }: TagTaskEntry) => (
		<TaskRow
			task={task}
			listState={listStates.get(task.taskId) ?? null}
			tags={tags}
			checklist={
				checklistId === null
					? null
					: {
							title: checklistTitle,
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

	return (
		<VStack gap={4}>
			<BackButton to="/tags" label="Tags" />

			<HStack gap={2} hAlign="between" vAlign="start">
				<VStack gap={0.5}>
					<Heading level={1}>{detail.name}</Heading>
					{detail.description === "" ? null : (
						<Text color="secondary">{detail.description}</Text>
					)}
				</VStack>

				<DropdownMenu
					hasChevron={false}
					placement="below"
					alignment="end"
					button={{
						label: "Tag actions",
						tooltip: "Tag actions",
						variant: "ghost",
						isIconOnly: true,
						icon: <MoreHorizontal aria-hidden />,
					}}
					items={[
						{ label: "Edit tag", onClick: () => setIsEditOpen(true) },
						{
							label: "Delete tag",
							variant: "destructive" as const,
							onClick: () => setIsDeletingTag(true),
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
						label={`${detail.name} progress`}
						percent={progress.percent}
						expectedPercent={elapsed === null ? null : elapsed * 100}
						footnote={`${progress.completed} / ${progress.total} ${
							progress.total === 1 ? "task" : "tasks"
						}${detail.deadline ? ` · due ${formatDate(detail.deadline)}` : ""}`}
					/>
				</VStack>
			</Card>

			<VelocityStats
				startDate={startDate}
				velocity={velocity}
				unit="tasks"
				isComplete={progress.total > 0 && progress.completed >= progress.total}
			/>

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
					title="Nothing carries this tag yet."
					description={`Write #${detail.name} in a task to add it here.`}
				/>
			) : open.length === 0 ? (
				<EmptyState
					title="All done."
					description="Every task with this tag is complete."
				/>
			) : (
				<Card padding={0}>
					<VStack gap={0} paddingBlock={2}>
						{openPaging.shown.map((entry, index) => (
							<div
								key={entry.task.taskId}
								className="thunderlist-row thunderlist-task-row"
							>
								{index === 0 ? null : <Divider />}
								{taskRow(entry)}
							</div>
						))}
						<ShowMore
							hidden={openPaging.hidden}
							onShowMore={openPaging.showMore}
						/>
					</VStack>
				</Card>
			)}

			<CompletedSection
				count={completed.length}
				clearLabel="Delete all completed"
				onClear={() => setIsClearingCompleted(true)}
				chart={
					<ProgressChart
						start={dayStart(startDate)}
						end={detail.deadline === null ? null : dayStart(detail.deadline)}
						now={Date.now()}
						target={progress.total}
						current={progress.completed}
						points={completionPoints(
							detail.tasks.map((entry) => entry.task),
							dayStart(startDate),
						)}
						startLabel={formatDate(startDate)}
						endLabel={
							detail.deadline === null
								? "No deadline"
								: formatDate(detail.deadline)
						}
						summary={`${progress.completed} of ${progress.total} tasks done since ${formatDate(startDate)}`}
					/>
				}
			>
				{completedPaging.shown.map((entry, index) => (
					<div
						key={entry.task.taskId}
						className="thunderlist-row thunderlist-task-row"
					>
						{index === 0 ? null : <Divider />}
						{taskRow(entry)}
					</div>
				))}
				<ShowMore
					hidden={completedPaging.hidden}
					onShowMore={completedPaging.showMore}
				/>
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
				isOpen={isEditOpen}
				onOpenChange={setIsEditOpen}
				tag={detail}
				existingNames={tags.map((tag) => tag.name)}
				onSubmit={(values) => {
					apply({ kind: "tag.update", tagId, patch: values });
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
				description="They will be deleted from wherever they live, along with any Today or Backlog entry pointing at them."
				actionLabel="Delete"
				onAction={() => {
					for (const entry of completed) {
						apply({ kind: "task.delete", taskId: entry.task.taskId });
					}
					setIsClearingCompleted(false);
				}}
			/>

			<AlertDialog
				isOpen={isDeletingTag}
				onOpenChange={setIsDeletingTag}
				title={`Delete the ${detail.name} tag?`}
				description={`It will be taken off ${progress.total} ${
					progress.total === 1 ? "task" : "tasks"
				}. The tasks themselves are not deleted.`}
				actionLabel="Delete"
				onAction={() => {
					apply({ kind: "tag.delete", tagId });
					setIsDeletingTag(false);
					void navigate({ to: "/tags" });
				}}
			/>
		</VStack>
	);
}
