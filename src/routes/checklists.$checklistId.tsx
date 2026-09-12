import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { ChecklistFormDialog } from "#/components/checklists/checklist-form-dialog";
import { ChecklistPickerDialog } from "#/components/checklists/checklist-picker-dialog";
import { QuickAddTask } from "#/components/checklists/quick-add-task";
import { TaskRenameDialog } from "#/components/checklists/task-rename-dialog";
import { TaskRow } from "#/components/checklists/task-row";
import { BackButton } from "#/components/common/back-button";
import { CompletedSection } from "#/components/common/completed-section";
import { DayStats } from "#/components/common/day-stats";
import { LoadingState } from "#/components/common/loading-state";
import { PaceLabel } from "#/components/common/pace-label";
import { ProgressChart } from "#/components/common/progress-chart";
import {
	formatExpectedTasks,
	ProgressMeter,
} from "#/components/common/progress-meter";
import { SectionSpinner } from "#/components/common/section-spinner";
import { ShowMore } from "#/components/common/show-more";
import { SortToggle } from "#/components/common/sort-toggle";
import { ErrorNotice } from "#/components/common/states";
import { VelocityStats } from "#/components/common/velocity-stats";
import { TagFormDialog } from "#/components/tags/tag-form-dialog";
import {
	type ChecklistValues,
	createTag,
	createTagResolver,
	createTask,
	resolveChecklistName,
	resolveTrackerName,
	setSpecialTag,
	updateTask,
	useApplyChange,
} from "#/lib/changes";
import { completionPoints, dayStart } from "#/lib/chart-points";
import {
	formatClock,
	formatDate,
	formatDeadline,
	formatSchedule,
} from "#/lib/format-date";
import { computeVelocity, localMoment, todayWindow } from "#/lib/progress";
import type { ParsedTitle } from "#/lib/tags/inline-tags";
import { mergeReads, orderTasks, type SortOrder } from "#/lib/tasks/tasks";
import { useFocusTask } from "#/lib/use-focus-task";
import { useNow } from "#/lib/use-now";
import { paceAt } from "#/lib/use-pace";
import { firstPage, PAGE_SIZE, useShowMore } from "#/lib/use-show-more";
import {
	checklistCompletedQuery,
	checklistOpenQuery,
	checklistQuery,
	checklistsQuery,
} from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { tagsQuery } from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import type { Task } from "#/schemas/task";

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
	loaderDeps: ({ search }) => ({ task: search.task }),
	loader: async ({ context, params, deps }) => {
		// Quick-add needs the tags, the trackers and the checklists, but nobody
		// is typing on the first frame, so none of them is waited for. The tags
		// also say which tasks are on Today, which is the bolt on a row.
		deferQuery(context.queryClient, tagsQuery());
		deferQuery(context.queryClient, trackersQuery());
		deferQuery(context.queryClient, checklistsQuery());

		// The checklist and the first page of what is left to do are the screen.
		await Promise.all([
			primeQuery(context.queryClient, checklistQuery(params.checklistId)),
			primeQuery(
				context.queryClient,
				checklistOpenQuery(params.checklistId, firstPage(deps.task)),
			),
		]);
	},
	component: ChecklistDetailPage,
});

function ChecklistDetailPage() {
	const { checklistId } = Route.useParams();
	const { task: focusTaskId } = Route.useSearch();
	const navigate = useNavigate();
	const { apply } = useApplyChange();

	const [renaming, setRenaming] = useState<Task | null>(null);
	const [moving, setMoving] = useState<Task | null>(null);
	const [isCreatingTag, setIsCreatingTag] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
	const [isDeletingChecklist, setIsDeletingChecklist] = useState(false);
	const [isClearingCompleted, setIsClearingCompleted] = useState(false);
	const [sort, setSort] = useState<SortOrder>("newest");
	const [openLimit, setOpenLimit] = useState(PAGE_SIZE);
	const [wantsCompleted, setWantsCompleted] = useState(false);

	const { data, isError, error, refetch } = useQuery(
		checklistQuery(checklistId),
	);

	/*
	 * What is still to do, a page at a time: the first page comes with the
	 * screen, and each "Show more" reads the next one then, not before. The rows
	 * on screen stay up while a longer page, or another order, is on its way.
	 */
	const openResult = useQuery({
		...checklistOpenQuery(checklistId, {
			sort,
			limit: openLimit,
			reveal: focusTaskId,
		}),
		placeholderData: keepPreviousData,
	});

	// The finished tasks are read once their section is opened, and not before.
	const completedResult = useQuery({
		...checklistCompletedQuery(checklistId),
		enabled: wantsCompleted,
	});
	const tagsResult = useQuery(tagsQuery());
	const trackersResult = useQuery(trackersQuery());
	const checklistsResult = useQuery(checklistsQuery());

	const detail = data ?? null;

	// The open tasks and the finished ones are read apart; the screen sorts the
	// two together.
	const allTasks = useMemo(
		() =>
			mergeReads(
				openResult.data?.items ?? [],
				completedResult.data ?? [],
				(task) => task.taskId,
			),
		[openResult.data, completedResult.data],
	);
	const rows = useMemo(() => orderTasks(allTasks, sort), [allTasks, sort]);

	// Done work sits below what is still to do, under its own heading.
	const open = useMemo(() => rows.filter((task) => !task.completed), [rows]);
	const completed = useMemo(
		() => rows.filter((task) => task.completed),
		[rows],
	);

	// Open tasks still on the server, past the ones read so far.
	const openHidden =
		openResult.data === undefined
			? 0
			: openResult.data.total - openResult.data.items.length;
	const openCount = open.length + openHidden;

	function showMoreOpen() {
		setOpenLimit(
			Math.max(openLimit, openResult.data?.items.length ?? 0) + PAGE_SIZE,
		);
	}

	// Twenty rows at a time, but never hiding the row a `?task=` link was sent to.
	const completedPaging = useShowMore(
		completed,
		completed.findIndex((task) => task.taskId === focusTaskId),
	);

	const tags = tagsResult.data ?? [];
	const trackers = trackersResult.data ?? [];
	// Any checklist but this one can stand as a task here: this one would be
	// waiting on itself.
	const otherChecklists = (checklistsResult.data ?? []).filter(
		(candidate) => candidate.checklistId !== checklistId,
	);

	useFocusTask(focusTaskId);
	const now = useNow();

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
			tags={tags}
			actions={{
				onToggle: (completed) => updateTask(apply, task.taskId, { completed }),
				onSetSpecial: (kind, isOn) =>
					setSpecialTag(apply, task, kind, isOn, tags),
				onSetUrgent: (urgent) => updateTask(apply, task.taskId, { urgent }),
				onSetImportant: (important) =>
					updateTask(apply, task.taskId, { important }),
				onRename: () => setRenaming(task),
				onMove: () => setMoving(task),
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
			// A line naming a tracker or another checklist becomes a task that
			// follows it, titled with its own title. A name matching nothing stays
			// ordinary text.
			const tracker = resolveTrackerName(trackers, line.trackerName);
			const linked = tracker
				? null
				: resolveChecklistName(otherChecklists, line.trackerName);

			createTask(apply, {
				checklistId,
				title: tracker?.title ?? linked?.title ?? line.title,
				tagIds: tracker || linked ? [] : line.tagNames.map(resolveTag),
				trackerId: tracker?.trackerId ?? null,
				linkedChecklistId: linked?.checklistId ?? null,
			});
		}
	}

	const { progress } = detail;
	const daily = detail.dailyWindow ?? null;
	const pace = paceAt(
		detail,
		progress.total === 0 ? null : progress.completed / progress.total,
		now,
	);
	const scheduleNote = formatSchedule(detail);
	// Today's hours, for a checklist paced daily, which its chart is drawn
	// against.
	const todays =
		daily === null || now === null ? null : todayWindow(daily, now);

	const velocity = computeVelocity({
		startDate: detail.startDate,
		deadline: detail.deadline,
		current: progress.completed,
		target: progress.total,
	});

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
						<PaceLabel status={pace.status} />
					</HStack>
					<ProgressMeter
						label={`${detail.title} progress`}
						percent={progress.percent}
						elapsed={pace.elapsed}
						expectedReading={
							pace.elapsed == null
								? undefined
								: formatExpectedTasks(pace.elapsed, progress.total)
						}
						footnote={`${progress.completed} / ${progress.total} ${
							progress.total === 1 ? "task" : "tasks"
						}${scheduleNote === null ? "" : ` · ${scheduleNote}`}`}
					/>
				</VStack>
			</Card>

			{/* Paced daily, it is measured in hours rather than days; see `DayStats`. */}
			{daily === null ? (
				<VelocityStats
					startDate={detail.startDate}
					velocity={velocity}
					unit="tasks"
					isComplete={
						progress.total > 0 && progress.completed >= progress.total
					}
				/>
			) : (
				<DayStats
					total={progress.total}
					completed={progress.completed}
					window={daily}
					now={now}
				/>
			)}

			<QuickAddTask
				tags={tags}
				trackers={trackers}
				checklists={otherChecklists}
				onAdd={addTasks}
			/>

			{openCount === 0 ? null : (
				<HStack gap={2} hAlign="between" vAlign="center">
					<Text type="label" weight="semibold" color="secondary">
						{openCount} to do
					</Text>
					<SortToggle order={sort} onChange={setSort} />
				</HStack>
			)}

			{progress.total === 0 ? (
				<EmptyState
					title="No tasks yet."
					description="Type above to add the first one. Tag it inline with #."
				/>
			) : openResult.data === undefined ? (
				openResult.isError ? (
					<ErrorNotice
						error={openResult.error}
						onRetry={() => void openResult.refetch()}
					/>
				) : (
					<SectionSpinner label="Loading tasks…" />
				)
			) : openCount === 0 ? (
				<EmptyState
					title="All done."
					description="Everything here is complete."
				/>
			) : (
				<Card padding={0}>
					<VStack gap={0} paddingBlock={2}>
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
						<ShowMore
							hidden={openHidden}
							isLoading={openResult.isPlaceholderData}
							onShowMore={showMoreOpen}
						/>
					</VStack>
				</Card>
			)}

			<CompletedSection
				count={progress.completed}
				clearLabel="Delete all completed"
				onClear={
					completedResult.data === undefined
						? undefined
						: () => setIsClearingCompleted(true)
				}
				onOpen={() => setWantsCompleted(true)}
				chart={
					// Drawn from the finished tasks against the viewer's clock, so only
					// once the browser has both.
					now === null || completedResult.data === undefined ? undefined : (
						<ProgressChart
							start={todays?.start ?? dayStart(detail.startDate)}
							end={
								todays?.end ?? localMoment(detail.deadline, detail.deadlineTime)
							}
							now={now}
							target={progress.total}
							current={progress.completed}
							points={completionPoints(
								allTasks,
								todays?.start ?? dayStart(detail.startDate),
							)}
							startLabel={
								daily === null
									? formatDate(detail.startDate)
									: formatClock(daily.from)
							}
							endLabel={
								daily !== null
									? formatClock(daily.to)
									: detail.deadline === null
										? "No deadline"
										: formatDeadline(detail.deadline, detail.deadlineTime)
							}
							summary={
								daily === null
									? `${progress.completed} of ${progress.total} tasks done since ${formatDate(detail.startDate)}`
									: `${progress.completed} of ${progress.total} tasks done`
							}
						/>
					)
				}
			>
				{/* The card has no padding of its own; each row brings its own. */}
				{completedResult.isError ? (
					<div className="thunderlist-row">
						<ErrorNotice
							error={completedResult.error}
							onRetry={() => void completedResult.refetch()}
						/>
					</div>
				) : completedResult.data === undefined ? (
					<div className="thunderlist-row">
						<SectionSpinner label="Loading completed tasks…" />
					</div>
				) : (
					<>
						{completedPaging.shown.map((task, index) => (
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
						<ShowMore
							hidden={completedPaging.hidden}
							onShowMore={completedPaging.showMore}
						/>
					</>
				)}
			</CompletedSection>

			<TaskRenameDialog
				isOpen={renaming !== null}
				onOpenChange={(open) => {
					if (!open) setRenaming(null);
				}}
				task={renaming}
				tags={tags}
				onSubmit={(parsed, details) => {
					if (renaming) {
						const resolveTag = createTagResolver(apply, tags);
						updateTask(apply, renaming.taskId, {
							title: parsed.title,
							tagIds: parsed.tagNames.map(resolveTag),
							...details,
						});
					}
					setRenaming(null);
				}}
			/>

			<ChecklistPickerDialog
				isOpen={moving !== null}
				onOpenChange={(open) => {
					if (!open) setMoving(null);
				}}
				title="Move to checklist"
				subtitle={moving?.title}
				checklists={otherChecklists}
				isLoading={checklistsResult.isPending}
				onPick={(target) => {
					if (moving) {
						apply({
							kind: "task.move",
							taskId: moving.taskId,
							checklistId: target,
						});
					}
					setMoving(null);
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
				tags={tags}
				resolveTags={(names) => names.map(createTagResolver(apply, tags))}
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
				description="They will be deleted."
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
