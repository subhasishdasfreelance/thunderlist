import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ChecklistFormDialog } from "#/components/checklists/checklist-form-dialog";
import { ChecklistPickerDialog } from "#/components/checklists/checklist-picker-dialog";
import { QuickAddTask } from "#/components/checklists/quick-add-task";
import { SPECIAL_CHECKLIST_ICONS } from "#/components/checklists/special-checklist-icons";
import { StageTabs } from "#/components/checklists/stage-tabs";
import { TaskRenameDialog } from "#/components/checklists/task-rename-dialog";
import { TaskRow } from "#/components/checklists/task-row";
import { BackButton } from "#/components/common/back-button";
import { DayStats } from "#/components/common/day-stats";
import { ListPagination } from "#/components/common/list-pagination";
import { ListLoading, LoadingState } from "#/components/common/loading-state";
import { PaceLabel } from "#/components/common/pace-label";
import { ProgressChart } from "#/components/common/progress-chart";
import {
	formatExpectedTasks,
	ProgressMeter,
} from "#/components/common/progress-meter";
import { SectionSpinner } from "#/components/common/section-spinner";
import { SortToggle } from "#/components/common/sort-toggle";
import { ErrorNotice } from "#/components/common/states";
import { VelocityStats } from "#/components/common/velocity-stats";
import { type ProgressView, ViewToggle } from "#/components/common/view-toggle";
import { TagFilter } from "#/components/tags/tag-filter";
import { SelectionBar } from "#/components/tasks/selection-bar";
import { TaskTypeDialog } from "#/components/tasks/task-type-dialog";
import { AssignDialog } from "#/components/teams/assign-dialog";
import { MemberFilter } from "#/components/teams/member-filter";
import { VisibilityButton } from "#/components/teams/visibility-button";
import {
	type ChecklistValues,
	createTagResolver,
	createTask,
	moveToBacklog,
	resolveChecklistName,
	resolveTags,
	resolveTrackerName,
	setSpecialTag,
	toggleAssignee,
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
import {
	matchesFilter,
	orderTasks,
	type SortOrder,
	shortTitle,
} from "#/lib/tasks/tasks";
import { useFocusTask } from "#/lib/use-focus-task";
import { useNow } from "#/lib/use-now";
import { paceAt } from "#/lib/use-pace";
import { firstPage, PAGE_SIZE } from "#/lib/use-pages";
import { useTaskSelection } from "#/lib/use-task-selection";
import { usePermissions, useSpace } from "#/lib/use-team";
import {
	checklistCompletedQuery,
	checklistFilteredQuery,
	checklistPageQuery,
	checklistQuery,
	checklistsQuery,
} from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { tagsQuery } from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import {
	checklistStages,
	nextStageId,
	specialChecklist,
	stageOf,
	stageParts,
} from "#/schemas/checklist";
import type { Task, TaskFilter } from "#/schemas/task";
import { memberName } from "#/schemas/team";

export const Route = createFileRoute("/checklists/$checklistId")({
	/**
	 * `?task=` names a task to bring into view.
	 *
	 * Arriving from Today, the useful thing is not the checklist but the task you
	 * were just looking at, which may be well down a long list — or at another
	 * stage. Keeping it in the URL rather than in memory means the trip survives
	 * a reload and a shared link lands in the same place.
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

		// The checklist and the first page of its first stage are the screen.
		await Promise.all([
			primeQuery(context.queryClient, checklistQuery(params.checklistId)),
			primeQuery(
				context.queryClient,
				checklistPageQuery(params.checklistId, firstPage(deps.task)),
			),
		]);
	},
	component: ChecklistDetailPage,
});

/**
 * One checklist: how it is going, and its tasks, a stage at a time.
 *
 * Its tasks go through its stages — "To do" and "Done" to begin with, or as
 * many as it is given — and the screen shows one stage at a time, opening on
 * the first, a page of twenty at a time.
 *
 * Above them is a filter: one person's tasks, in a team, and one tag's. It
 * narrows everything on the screen at once — the figures, the chart, the
 * counts on the stages and the list — so what the numbers say is always about
 * the rows under them. That is how a project manager reads how one person's
 * work is going.
 */
function ChecklistDetailPage() {
	const { checklistId } = Route.useParams();
	const { task: focusTaskId } = Route.useSearch();
	const navigate = useNavigate();
	const { apply, applyAsync } = useApplyChange();
	const space = useSpace();
	const team = space?.team ?? null;
	// Adding and deleting tasks is shaping the work; updating one is the row's
	// own business. See `Capability`.
	const { canManageContent, canUpdateTasks } = usePermissions();

	const [renaming, setRenaming] = useState<Task | null>(null);
	const [moving, setMoving] = useState<Task | null>(null);
	const [typing, setTyping] = useState<Task | null>(null);
	const [assigning, setAssigning] = useState<Task | null>(null);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
	const [isDeletingChecklist, setIsDeletingChecklist] = useState(false);
	const [isClearingCompleted, setIsClearingCompleted] = useState(false);
	const [sort, setSort] = useState<SortOrder>("newest");
	// Picked by hand; until then, where `?task=` is, or the first of each.
	const [stageId, setStageId] = useState<string | undefined>(undefined);
	const [page, setPage] = useState<number | undefined>(undefined);
	const [view, setView] = useState<ProgressView>("list");
	const [assignee, setAssignee] = useState<string | undefined>(undefined);
	const [tagId, setTagId] = useState<string | undefined>(undefined);

	const filter: TaskFilter = { assignee, tag: tagId };
	const isFiltered = assignee !== undefined || tagId !== undefined;

	const { data, isError, error, refetch } = useQuery(
		checklistQuery(checklistId),
	);
	// The same figures, counting only what the filter lets through.
	const filteredResult = useQuery({
		...checklistFilteredQuery(checklistId, filter),
		enabled: isFiltered,
		placeholderData: keepPreviousData,
	});

	/*
	 * A page of one stage. The rows on screen stay up while another page, stage
	 * or order is on its way.
	 */
	const pageResult = useQuery({
		...checklistPageQuery(checklistId, {
			sort,
			limit: PAGE_SIZE,
			page,
			stageId,
			reveal:
				stageId === undefined && page === undefined ? focusTaskId : undefined,
			assignee,
			tag: tagId,
		}),
		placeholderData: keepPreviousData,
	});

	const detail = data ?? null;
	const stages = checklistStages(detail ?? {});
	const lastStage = stages[stages.length - 1];
	const shownStageId = stageId ?? pageResult.data?.stageId ?? stages[0].stageId;
	const shownStage =
		stages.find((stage) => stage.stageId === shownStageId) ?? stages[0];
	const isDoneStage = shownStage.stageId === lastStage.stageId;

	// Every finished task, for the chart and for clearing them: read once the
	// last stage is open, and not before.
	const completedResult = useQuery({
		...checklistCompletedQuery(checklistId),
		enabled: isDoneStage,
	});
	const completed = useMemo(
		() =>
			(completedResult.data ?? []).filter((task) =>
				matchesFilter(task, { assignee, tag: tagId }),
			),
		[completedResult.data, assignee, tagId],
	);

	const tagsResult = useQuery(tagsQuery());
	const trackersResult = useQuery(trackersQuery());
	const checklistsResult = useQuery(checklistsQuery());

	// A task ticked or moved on screen is patched in place; the screen's order
	// is what places it.
	const rows = useMemo(
		() => orderTasks(pageResult.data?.items ?? [], sort),
		[pageResult.data, sort],
	);

	const tags = tagsResult.data ?? [];
	const trackers = trackersResult.data ?? [];
	// Any checklist but this one can stand as a task here, or be moved into:
	// this one would be waiting on itself.
	const otherChecklists = (checklistsResult.data ?? []).filter(
		(candidate) => candidate.checklistId !== checklistId,
	);

	useFocusTask(focusTaskId);
	const now = useNow();
	// The rows a text selection runs across, to be moved on together.
	const { picked, clear } = useTaskSelection();

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

	// The Inbox or the Backlog, which every space has and which are everyone's.
	const special = detail.special ?? null;
	// Somewhere to park a task, from any checklist but the Backlog itself.
	const backlog =
		special === "backlog"
			? null
			: specialChecklist(checklistsResult.data ?? [], "backlog");
	// What the figures count: everything, or what the filter lets through.
	const figures = isFiltered ? (filteredResult.data ?? detail) : detail;
	const { progress } = figures;

	/** Back to the first page, for a different list shown in its place. */
	const turn =
		<T,>(set: (value: T) => void) =>
		(value: T) => {
			set(value);
			setPage(undefined);
		};

	/** One task row, the same at every stage. */
	const taskRow = (task: Task) => (
		<TaskRow
			task={task}
			tags={tags}
			stages={stages}
			backlog={
				backlog === null
					? undefined
					: {
							title: backlog.title,
							onMove: () =>
								void moveToBacklog(applyAsync, task, backlog.checklistId, tags),
						}
			}
			actions={{
				onToggle: (isDone) =>
					updateTask(apply, task.taskId, { completed: isDone }),
				onSetStage: (next) => updateTask(apply, task.taskId, { stageId: next }),
				onSetSpecial: (kind, isOn) =>
					setSpecialTag(apply, task, kind, isOn, tags),
				onSetUrgent: (urgent) => updateTask(apply, task.taskId, { urgent }),
				onSetImportant: (important) =>
					updateTask(apply, task.taskId, { important }),
				onSetType: () => setTyping(task),
				onRename: () => setRenaming(task),
				onMove: () => setMoving(task),
				onDelete: () => setPendingDelete(task),
				onAssign: team === null ? undefined : () => setAssigning(task),
				onToggleMine:
					space?.team == null
						? undefined
						: () => toggleAssignee(apply, task, space.email),
			}}
		/>
	);

	// Only someone who can move a task on has anything to do with a pick.
	const pickedTasks = canUpdateTasks
		? rows.filter((task) => picked.has(task.taskId))
		: [];

	/** Every picked task on to its next stage; see `nextStageId`. */
	function moveOn() {
		for (const task of pickedTasks) {
			const next = nextStageId(task, stages);
			if (next !== null) updateTask(apply, task.taskId, { stageId: next });
		}
		clear();
	}

	/**
	 * Every picked task to one stage — all but those already there, and those
	 * finished by a tracker or a checklist, which cannot be made done by hand.
	 */
	function moveTo(target: string) {
		for (const task of pickedTasks) {
			const isTracked =
				task.trackerId != null || task.linkedChecklistId != null;
			if (stageOf(task, stages) === target) continue;
			if (isTracked && target === lastStage.stageId) continue;
			updateTask(apply, task.taskId, { stageId: target });
		}
		clear();
	}

	/**
	 * Add a pasted block of tasks, tags and all.
	 *
	 * One resolver for the whole block, so a tag written on three lines is
	 * created once rather than three times.
	 */
	function addTasks(lines: Array<ParsedTitle>) {
		const resolveTag = createTagResolver(apply, tags, canManageContent);

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
				tagIds: tracker || linked ? [] : resolveTags(resolveTag, line.tagNames),
				trackerId: tracker?.trackerId ?? null,
				linkedChecklistId: linked?.checklistId ?? null,
				urgent: line.urgent,
				important: line.important,
			});
		}
	}

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

	const velocity =
		now === null
			? null
			: computeVelocity({
					startDate: detail.startDate,
					deadline: detail.deadline,
					deadlineTime: detail.deadlineTime,
					current: progress.completed,
					target: progress.total,
					now,
				});

	// Who and what the figures are narrowed to, said under them.
	const person = team?.members.find((member) => member.email === assignee);
	const chosenTag = tags.find((tag) => tag.tagId === tagId);
	const filterNote = isFiltered
		? `Counting only ${[
				assignee === undefined
					? null
					: `${person === undefined ? assignee : memberName(person)}'s tasks`,
				chosenTag === undefined ? null : `tasks tagged #${chosenTag.name}`,
			]
				.filter((part) => part !== null)
				.join(", ")}.`
		: null;

	const chart =
		now === null || completedResult.data === undefined ? null : (
			<ProgressChart
				start={todays?.start ?? dayStart(detail.startDate)}
				end={todays?.end ?? localMoment(detail.deadline, detail.deadlineTime)}
				now={now}
				target={progress.total}
				current={progress.completed}
				points={completionPoints(
					completed,
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
		);

	const counts = pageResult.data?.counts ?? {};
	const hasAnyTask = detail.progress.total > 0;

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<BackButton to="/checklists" label="Checklists" />
				{/* The Inbox and the Backlog are everyone's, in a team as anywhere. */}
				{special !== null ? null : (
					<VisibilityButton
						noun="checklist"
						visibleTo={detail.visibleTo}
						onChange={(visibleTo) =>
							apply({
								kind: "checklist.update",
								checklistId,
								patch: { visibleTo },
							})
						}
					/>
				)}
			</HStack>

			<HStack gap={2} hAlign="between" vAlign="start">
				<VStack gap={0.5}>
					<HStack gap={2} vAlign="center">
						{special === null ? null : (
							<Icon icon={SPECIAL_CHECKLIST_ICONS[special]} color="secondary" />
						)}
						<Heading level={1}>{detail.title}</Heading>
					</HStack>
					{detail.description === "" ? null : (
						<Text color="secondary">{detail.description}</Text>
					)}
				</VStack>

				{canManageContent ? (
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
							{
								label: "Edit checklist",
								icon: Pencil,
								onClick: () => setIsEditOpen(true),
							},
							// Every space has these two: tasks with nowhere else to go are
							// put in the Inbox, and parked work in the Backlog.
							...(special !== null
								? []
								: [
										{ type: "divider" as const },
										{
											label: "Delete checklist",
											icon: Trash2,
											variant: "destructive" as const,
											onClick: () => setIsDeletingChecklist(true),
										},
									]),
						]}
					/>
				) : null}
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
						stages={{
							parts: stageParts(stages, progress.byStage),
							total: progress.total,
						}}
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
					{filterNote === null ? null : (
						<Text type="supporting">{filterNote}</Text>
					)}
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

			{canManageContent ? (
				<QuickAddTask
					tags={tags}
					trackers={trackers}
					checklists={otherChecklists}
					onAdd={addTasks}
				/>
			) : null}

			{!hasAnyTask ? (
				<EmptyState
					title="No tasks yet."
					description={
						canManageContent
							? "Type above to add the first one. Tag it inline with #."
							: "Nothing has been added here yet."
					}
				/>
			) : (
				<VStack gap={2}>
					{/* The filter row: whose, and which tag's, then the order. */}
					<HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
						<HStack gap={1} vAlign="center" wrap="wrap">
							<MemberFilter value={assignee} onChange={turn(setAssignee)} />
							<TagFilter tags={tags} value={tagId} onChange={turn(setTagId)} />
						</HStack>
						<HStack gap={1} vAlign="center">
							{isDoneStage && chart !== null ? (
								<ViewToggle
									view={view}
									onChange={setView}
									label="Show completed work as a list or a graph"
								/>
							) : null}
							{isDoneStage && canManageContent && completed.length > 0 ? (
								<Button
									label="Delete all completed"
									variant="ghost"
									size="sm"
									icon={<Trash2 aria-hidden />}
									onClick={() => setIsClearingCompleted(true)}
								/>
							) : null}
							<SortToggle order={sort} onChange={turn(setSort)} />
						</HStack>
					</HStack>

					<StageTabs
						stages={stages}
						value={shownStage.stageId}
						counts={counts}
						onChange={(next) => {
							setStageId(next);
							setPage(undefined);
						}}
					/>

					{pageResult.data === undefined ? (
						pageResult.isError ? (
							<ErrorNotice
								error={pageResult.error}
								onRetry={() => void pageResult.refetch()}
							/>
						) : (
							<SectionSpinner label="Loading tasks…" />
						)
					) : isDoneStage && view === "chart" && chart !== null ? (
						<Card padding={3}>{chart}</Card>
					) : (
						<ListLoading isLoading={pageResult.isPlaceholderData}>
							{rows.length === 0 ? (
								<EmptyState
									isCompact
									title={
										isFiltered
											? "Nothing here for this filter."
											: shownStage.stageId === stages[0].stageId &&
													(counts[lastStage.stageId] ?? 0) > 0
												? "All done."
												: `Nothing in ${shownStage.name}.`
									}
									description={
										isFiltered
											? `No task at ${shownStage.name} matches it.`
											: `Tasks at ${shownStage.name} show up here.`
									}
								/>
							) : (
								<Card padding={0}>
									<VStack gap={0} paddingBlock={2}>
										{rows.map((task, index) => (
											<div
												key={task.taskId}
												className="thunderlist-row thunderlist-task-row"
												data-task-id={task.taskId}
												data-focused={task.taskId === focusTaskId}
												data-picked={pickedTasks.includes(task)}
											>
												{index === 0 ? null : <Divider />}
												{taskRow(task)}
											</div>
										))}
										<ListPagination
											// The page asked for, while it is on its way: the one on
											// screen until then would pull the highlight back.
											page={
												pageResult.isPlaceholderData
													? (page ?? pageResult.data.page)
													: pageResult.data.page
											}
											total={pageResult.data.total}
											onChange={setPage}
										/>
									</VStack>
								</Card>
							)}
						</ListLoading>
					)}
				</VStack>
			)}

			{pickedTasks.length === 0 ? null : (
				<SelectionBar
					count={pickedTasks.length}
					onNextStage={
						pickedTasks.some((task) => nextStageId(task, stages) !== null)
							? moveOn
							: undefined
					}
					stages={stages}
					onMoveTo={moveTo}
					onClear={clear}
				/>
			)}

			<AssignDialog
				isOpen={assigning !== null}
				onOpenChange={(open) => {
					if (!open) setAssigning(null);
				}}
				task={assigning}
				onSubmit={(assignees) => {
					if (assigning) updateTask(apply, assigning.taskId, { assignees });
					setAssigning(null);
				}}
			/>

			<TaskTypeDialog
				isOpen={typing !== null}
				onOpenChange={(open) => {
					if (!open) setTyping(null);
				}}
				task={typing}
				onPick={(typeId) => {
					if (typing) updateTask(apply, typing.taskId, { typeId });
					setTyping(null);
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

			<ChecklistFormDialog
				isOpen={isEditOpen}
				onOpenChange={setIsEditOpen}
				checklist={detail}
				tags={tags}
				resolveTags={(names) =>
					resolveTags(createTagResolver(apply, tags, canManageContent), names)
				}
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
				title={`Delete "${shortTitle(pendingDelete?.title ?? "")}"?`}
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
				description={
					isFiltered
						? "Only the completed tasks this filter shows will be deleted."
						: "They will be deleted."
				}
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
