import { AlertDialog } from "@astryxdesign/core/AlertDialog";
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
import { MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { ChecklistPickerDialog } from "#/components/checklists/checklist-picker-dialog";
import { QuickAddTask } from "#/components/checklists/quick-add-task";
import { TaskRenameDialog } from "#/components/checklists/task-rename-dialog";
import { TaskRow } from "#/components/checklists/task-row";
import { BackButton } from "#/components/common/back-button";
import { CompletedSection } from "#/components/common/completed-section";
import { DayStats } from "#/components/common/day-stats";
import { ListPagination } from "#/components/common/list-pagination";
import { LoadingState } from "#/components/common/loading-state";
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
import { SPECIAL_TAG_ICONS } from "#/components/tags/special-tag-icons";
import { TagFormDialog } from "#/components/tags/tag-form-dialog";
import { TaskTypeDialog } from "#/components/tasks/task-type-dialog";
import { AssignDialog } from "#/components/teams/assign-dialog";
import { MemberFilter } from "#/components/teams/member-filter";
import { VisibilityButton } from "#/components/teams/visibility-button";
import { TrackerCard } from "#/components/trackers/tracker-card";
import {
	createTagResolver,
	createTask,
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
	formatDateWithWeekday,
	formatDeadline,
	formatSchedule,
} from "#/lib/format-date";
import { computeVelocity, localMoment, todayWindow } from "#/lib/progress";
import { type ParsedTitle, withInlineTag } from "#/lib/tags/inline-tags";
import {
	isAssignedTo,
	mergeReads,
	orderByTask,
	type SortOrder,
} from "#/lib/tasks/tasks";
import { useFocusTask } from "#/lib/use-focus-task";
import { useNow } from "#/lib/use-now";
import { paceAt } from "#/lib/use-pace";
import { firstPage, PAGE_SIZE, usePages } from "#/lib/use-pages";
import { usePermissions, useSpace } from "#/lib/use-team";
import { checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import {
	tagCompletedQuery,
	tagForQuery,
	tagOpenQuery,
	tagQuery,
	tagsQuery,
} from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import { checklistStages } from "#/schemas/checklist";
import { todayDateOnly } from "#/schemas/common";
import { type TagTaskEntry, tagStartDate } from "#/schemas/tag";
import type { Task } from "#/schemas/task";
import { memberName } from "#/schemas/team";

export const Route = createFileRoute("/tags/$tagId")({
	/** `?task=` names a task to scroll to and ring; see `useFocusTask`. */
	validateSearch: (search: Record<string, unknown>) => ({
		task: typeof search.task === "string" ? search.task : undefined,
	}),
	loaderDeps: ({ search }) => ({ task: search.task }),
	loader: async ({ context, params, deps }) => {
		// Every tag, for the highlights in the titles, Today's bolt and the name
		// check when editing; the trackers and checklists, for a `&` line typed
		// into quick-add, and for where each task lives. None of them is waited
		// for.
		deferQuery(context.queryClient, tagsQuery());
		deferQuery(context.queryClient, trackersQuery());
		deferQuery(context.queryClient, checklistsQuery());

		// The tag and the first page of what is left to do are the screen.
		await Promise.all([
			primeQuery(context.queryClient, tagQuery(params.tagId)),
			primeQuery(
				context.queryClient,
				tagOpenQuery(params.tagId, firstPage(deps.task)),
			),
		]);
	},
	component: TagDetailPage,
});

/**
 * One tag, read the way a checklist is.
 *
 * Progress against the tag's own dates, the speed figures, what is left to do
 * and what is done, as a list or a graph. The difference is where the tasks
 * come from: a tag gathers them from any number of checklists, so every row
 * names the checklist its task lives in — and the stage it is at there — and
 * takes you there.
 *
 * Tasks can be typed straight in, as on a checklist. One typed here carries
 * this tag, written at the end of its title, and goes into the Inbox — which
 * is how Today, a tag like any other, gets filled in.
 *
 * In a team, the work can be narrowed to one person's, and everything on the
 * screen follows: the figures, the chart and the lists.
 */
function TagDetailPage() {
	const { tagId } = Route.useParams();
	const { task: focusTaskId } = Route.useSearch();
	const navigate = useNavigate();
	const { apply } = useApplyChange();
	const space = useSpace();
	const team = space?.team ?? null;
	const { canManageContent, canUpdateTasks } = usePermissions();

	const [renaming, setRenaming] = useState<Task | null>(null);
	const [moving, setMoving] = useState<TagTaskEntry | null>(null);
	const [typing, setTyping] = useState<Task | null>(null);
	const [assigning, setAssigning] = useState<Task | null>(null);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
	const [isDeletingTag, setIsDeletingTag] = useState(false);
	const [isClearingCompleted, setIsClearingCompleted] = useState(false);
	const [sort, setSort] = useState<SortOrder>("newest");
	// Picked by hand; until then, the page `?task=` is on, or the first.
	const [page, setPage] = useState<number | undefined>(undefined);
	const [wantsCompleted, setWantsCompleted] = useState(false);
	// In a team, one person's work rather than everyone's; see `MemberFilter`.
	const [assignee, setAssignee] = useState<string | undefined>(undefined);

	const { data, isError, error, refetch } = useQuery(tagQuery(tagId));
	// The same figures, counting only that person's work.
	const personalResult = useQuery({
		...tagForQuery(tagId, assignee ?? ""),
		enabled: assignee !== undefined,
		placeholderData: keepPreviousData,
	});

	/*
	 * What is still to do, a page at a time, as on a checklist's screen. The
	 * rows on screen stay up while another page, or another order, is on its
	 * way.
	 */
	const openResult = useQuery({
		...tagOpenQuery(tagId, {
			sort,
			limit: PAGE_SIZE,
			page,
			reveal: page === undefined ? focusTaskId : undefined,
			assignee,
		}),
		placeholderData: keepPreviousData,
	});

	// The finished tasks are read once their section is opened, and not before.
	const completedResult = useQuery({
		...tagCompletedQuery(tagId),
		enabled: wantsCompleted,
	});
	const tagsResult = useQuery(tagsQuery());
	const trackersResult = useQuery(trackersQuery());
	const checklistsResult = useQuery(checklistsQuery());

	const detail = data ?? null;

	// Ticked on screen, a task stays in the open read until the refetch; it is
	// drawn with the finished ones from the moment it is ticked.
	const open = useMemo(
		() =>
			orderByTask(
				openResult.data?.items ?? [],
				sort,
				(entry) => entry.task,
			).filter((entry) => !entry.task.completed),
		[openResult.data, sort],
	);
	const completed = useMemo(
		() =>
			orderByTask(
				mergeReads(
					(openResult.data?.items ?? []).filter(
						(entry) => entry.task.completed,
					),
					completedResult.data ?? [],
					(entry) => entry.task.taskId,
				),
				sort,
				(entry) => entry.task,
			).filter(
				(entry) => entry.task.completed && isAssignedTo(entry.task, assignee),
			),
		[openResult.data, completedResult.data, sort, assignee],
	);

	// Twenty rows a page, opening on the one a `?task=` link was sent to.
	const completedPages = usePages(
		completed,
		completed.findIndex((entry) => entry.task.taskId === focusTaskId),
	);

	const tags = tagsResult.data ?? [];
	const trackers = trackersResult.data ?? [];
	const checklists = checklistsResult.data ?? [];

	useFocusTask(focusTaskId);
	const now = useNow();

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

	// What the figures count: everyone's work, or the one person's picked.
	const figures =
		assignee === undefined ? detail : (personalResult.data ?? detail);
	const { progress } = figures;
	const startDate = tagStartDate(detail);
	const daily = detail.dailyWindow ?? null;
	// The progress counts trackers too, one each; the Completed section lists
	// only tasks.
	const finishedTrackers = figures.trackers.filter(
		({ tracker }) => tracker.progress.percent >= 100,
	).length;
	const pace = paceAt(
		{ ...detail, startDate },
		progress.total === 0 ? null : progress.completed / progress.total,
		now,
	);
	const scheduleNote = formatSchedule(detail);
	// Today's hours, for a tag paced daily — Today's own — which its chart is
	// drawn against.
	const todays =
		daily === null || now === null ? null : todayWindow(daily, now);

	const velocity =
		now === null
			? null
			: computeVelocity({
					startDate,
					deadline: detail.deadline,
					deadlineTime: detail.deadlineTime,
					current: progress.completed,
					target: progress.total,
					now,
				});

	const Mark =
		detail.special === null ? null : SPECIAL_TAG_ICONS[detail.special];
	const person = team?.members.find((member) => member.email === assignee);

	/** Where a task lives, and the stages it goes through there. */
	const stagesFor = (checklistId: string | null) =>
		checklistStages(
			checklists.find((checklist) => checklist.checklistId === checklistId) ??
				{},
		);

	/**
	 * Add a pasted block of tasks, each carrying this tag.
	 *
	 * One resolver for the whole block, so a tag written on three lines is
	 * created once rather than three times.
	 */
	function addTasks(lines: Array<ParsedTitle>) {
		if (detail === null) return;
		const resolveTag = createTagResolver(apply, tags, canManageContent);

		for (const line of lines) {
			// A line naming a tracker or a checklist becomes a task that follows
			// it, titled with its own title. A name matching nothing stays text.
			const tracker = resolveTrackerName(trackers, line.trackerName);
			const linked = tracker
				? null
				: resolveChecklistName(checklists, line.trackerName);
			const written =
				tracker || linked ? [] : resolveTags(resolveTag, line.tagNames);

			// No checklist: it goes into the Inbox; see `ensureInbox`.
			createTask(apply, {
				checklistId: null,
				title: withInlineTag(
					tracker?.title ?? linked?.title ?? line.title,
					detail.name,
				),
				tagIds: [...new Set([...written, detail.tagId])],
				trackerId: tracker?.trackerId ?? null,
				linkedChecklistId: linked?.checklistId ?? null,
				urgent: line.urgent,
				important: line.important,
			});
		}
	}

	/*
	 * Clearing the finished tasks off Today or the Backlog only untags them:
	 * those are plans, and each task stays in the checklist it lives in. Any
	 * other tag's page deletes them, as a checklist's does.
	 */
	const special = detail.special;

	function clearCompleted() {
		for (const entry of completed) {
			if (special === null) {
				apply({ kind: "task.delete", taskId: entry.task.taskId });
			} else {
				setSpecialTag(apply, entry.task, special, false, tags);
			}
		}
	}

	/** One task row, used by both the open and the completed sections. */
	const taskRow = (entry: TagTaskEntry) => {
		const { task, checklistId, checklistTitle } = entry;

		return (
			<TaskRow
				task={task}
				tags={tags}
				stages={stagesFor(checklistId)}
				isStageShown
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
					onToggle: (isDone) =>
						updateTask(apply, task.taskId, { completed: isDone }),
					onSetStage: (next) =>
						updateTask(apply, task.taskId, { stageId: next }),
					onSetSpecial: (kind, isOn) =>
						setSpecialTag(apply, task, kind, isOn, tags),
					onSetUrgent: (urgent) => updateTask(apply, task.taskId, { urgent }),
					onSetImportant: (important) =>
						updateTask(apply, task.taskId, { important }),
					onSetType: () => setTyping(task),
					onRename: () => setRenaming(task),
					onMove: () => setMoving(entry),
					onDelete: () => setPendingDelete(task),
					onAssign: team === null ? undefined : () => setAssigning(task),
					onToggleMine:
						space?.team == null
							? undefined
							: () => toggleAssignee(apply, task, space.email),
				}}
			/>
		);
	};

	// Today's page says which day it is, as the Today screen always did.
	const subtitle =
		special === "today"
			? formatDateWithWeekday(todayDateOnly())
			: detail.description;

	const openTotal = openResult.data?.total ?? 0;

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<BackButton to="/tags" label="Tags" />
				{/* Today and the Backlog are everyone's, in a team as anywhere. */}
				{special === null ? (
					<VisibilityButton
						noun="tag"
						visibleTo={detail.visibleTo}
						onChange={(visibleTo) =>
							apply({
								kind: "tag.update",
								tagId: detail.tagId,
								patch: { visibleTo },
							})
						}
					/>
				) : null}
			</HStack>

			<HStack gap={2} hAlign="between" vAlign="start">
				<VStack gap={0.5}>
					<HStack gap={2} vAlign="center">
						{Mark === null ? null : <Icon icon={Mark} color="secondary" />}
						<Heading level={1}>{detail.name}</Heading>
					</HStack>
					{subtitle === "" ? null : (
						// Formatted in the viewer's locale, so server and client can differ.
						<span suppressHydrationWarning>
							<Text color="secondary">{subtitle}</Text>
						</span>
					)}
				</VStack>

				{canManageContent ? (
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
							// Today and the Backlog can be renamed but never deleted: the bolt
							// and the menu on every row write them.
							...(special === null
								? [
										{
											label: "Delete tag",
											variant: "destructive" as const,
											onClick: () => setIsDeletingTag(true),
										},
									]
								: []),
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
						label={`${detail.name} progress`}
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
					{assignee === undefined ? null : (
						<Text type="supporting">
							Counting only{" "}
							{person === undefined ? assignee : memberName(person)}'s work.
						</Text>
					)}
				</VStack>
			</Card>

			{/* Paced daily, it is measured in hours rather than days; see `DayStats`. */}
			{daily === null ? (
				<VelocityStats
					startDate={startDate}
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

			{/* Each counts in the figures above as one thing to finish, as a task does. */}
			{figures.trackers.length === 0 ? null : (
				<VStack gap={2}>
					<Text type="label" weight="semibold" color="secondary">
						Trackers
					</Text>
					{figures.trackers.map(({ tracker }) => (
						<TrackerCard
							key={tracker.trackerId}
							tracker={tracker}
							tags={tags}
						/>
					))}
				</VStack>
			)}

			{/* Adding a task is shaping the work; see `Capability`. */}
			{canManageContent ? (
				<QuickAddTask
					tags={tags}
					trackers={trackers}
					checklists={checklists}
					onAdd={addTasks}
				/>
			) : null}

			{detail.progress.total === 0 ? null : (
				<HStack gap={2} hAlign="between" vAlign="center">
					<Text type="label" weight="semibold" color="secondary">
						{openTotal} to do
					</Text>
					<HStack gap={1} vAlign="center">
						<MemberFilter
							value={assignee}
							onChange={(next) => {
								setAssignee(next);
								setPage(undefined);
							}}
						/>
						<SortToggle
							order={sort}
							onChange={(next) => {
								setSort(next);
								setPage(undefined);
							}}
						/>
					</HStack>
				</HStack>
			)}

			{/* Its progress counts its trackers too; this is no task carrying it. */}
			{detail.progress.total === detail.trackers.length ? (
				detail.trackers.length === 0 ? (
					<EmptyState
						title="Nothing carries this tag yet."
						description={
							!canManageContent
								? "Nothing has been tagged with it yet."
								: special === "today"
									? "Type a task above, or press the bolt on any task."
									: `Type a task above, or write #${detail.name} in one.`
						}
					/>
				) : null
			) : openResult.data === undefined ? (
				openResult.isError ? (
					<ErrorNotice
						error={openResult.error}
						onRetry={() => void openResult.refetch()}
					/>
				) : (
					<SectionSpinner label="Loading tasks…" />
				)
			) : open.length === 0 ? (
				<EmptyState
					title={assignee === undefined ? "All done." : "Nothing to do here."}
					description={
						assignee === undefined
							? "Every task with this tag is complete."
							: "No open task with this tag is assigned to them."
					}
				/>
			) : (
				<Card padding={0}>
					<VStack gap={0} paddingBlock={2}>
						{open.map((entry, index) => (
							<div
								key={entry.task.taskId}
								className="thunderlist-row thunderlist-task-row"
								data-task-id={entry.task.taskId}
								data-focused={entry.task.taskId === focusTaskId}
							>
								{index === 0 ? null : <Divider />}
								{taskRow(entry)}
							</div>
						))}
						<ListPagination
							page={openResult.data.page}
							total={openResult.data.total}
							onChange={setPage}
						/>
					</VStack>
				</Card>
			)}

			<CompletedSection
				count={progress.completed - finishedTrackers}
				clearLabel={
					special === null
						? "Delete all completed"
						: `Clear from #${detail.name}`
				}
				onClear={
					// Off Today or the Backlog it only takes the tag off, which is an
					// update; anywhere else it deletes them.
					completedResult.data === undefined ||
					!(special === null ? canManageContent : canUpdateTasks)
						? undefined
						: () => setIsClearingCompleted(true)
				}
				onOpen={() => setWantsCompleted(true)}
				chart={
					// Drawn from the finished tasks against the viewer's clock, so only
					// once the browser has both.
					now === null || completedResult.data === undefined ? undefined : (
						<ProgressChart
							start={todays?.start ?? dayStart(startDate)}
							end={
								todays?.end ?? localMoment(detail.deadline, detail.deadlineTime)
							}
							now={now}
							target={progress.total}
							current={progress.completed}
							points={completionPoints(
								[
									...completed.map((entry) => entry.task),
									// A tracker is done on the day it reached its target.
									...figures.trackers.map(({ tracker, completedOn }) => ({
										taskId: tracker.trackerId,
										completed: tracker.progress.percent >= 100,
										completedAt:
											completedOn === null
												? null
												: new Date(dayStart(completedOn)).toISOString(),
									})),
								],
								todays?.start ?? dayStart(startDate),
							)}
							startLabel={
								daily === null ? formatDate(startDate) : formatClock(daily.from)
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
									? `${progress.completed} of ${progress.total} tasks done since ${formatDate(startDate)}`
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
						{completedPages.shown.map((entry, index) => (
							<div
								key={entry.task.taskId}
								className="thunderlist-row thunderlist-task-row"
								data-task-id={entry.task.taskId}
								data-focused={entry.task.taskId === focusTaskId}
							>
								{index === 0 ? null : <Divider />}
								{taskRow(entry)}
							</div>
						))}
						<ListPagination
							page={completedPages.page}
							total={completedPages.total}
							onChange={completedPages.setPage}
						/>
					</>
				)}
			</CompletedSection>

			<AssignDialog
				isOpen={assigning !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setAssigning(null);
				}}
				task={assigning}
				onSubmit={(assignees) => {
					if (assigning) updateTask(apply, assigning.taskId, { assignees });
					setAssigning(null);
				}}
			/>

			<TaskTypeDialog
				isOpen={typing !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setTyping(null);
				}}
				task={typing}
				onPick={(typeId) => {
					if (typing) updateTask(apply, typing.taskId, { typeId });
					setTyping(null);
				}}
			/>

			<ChecklistPickerDialog
				isOpen={moving !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setMoving(null);
				}}
				title="Move to checklist"
				subtitle={moving?.task.title}
				checklists={checklists.filter(
					(checklist) => checklist.checklistId !== moving?.checklistId,
				)}
				isLoading={checklistsResult.isPending}
				onPick={(target) => {
					if (moving) {
						apply({
							kind: "task.move",
							taskId: moving.task.taskId,
							checklistId: target,
						});
					}
					setMoving(null);
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

			<TagFormDialog
				isOpen={isEditOpen}
				onOpenChange={setIsEditOpen}
				tag={detail}
				existingNames={tags.map((tag) => tag.name)}
				onSubmit={(values) => {
					// The address may be `today` rather than the tag's id.
					apply({ kind: "tag.update", tagId: detail.tagId, patch: values });
					setIsEditOpen(false);
				}}
			/>

			<AlertDialog
				isOpen={pendingDelete !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setPendingDelete(null);
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
				title={
					special === null
						? `Delete ${completed.length} completed ${completed.length === 1 ? "task" : "tasks"}?`
						: `Clear ${completed.length} completed from #${detail.name}?`
				}
				description={
					special === null
						? "They will be deleted from wherever they live."
						: `They are only taken off #${detail.name}, and stay in their checklists.`
				}
				actionLabel={special === null ? "Delete" : "Clear"}
				onAction={() => {
					clearCompleted();
					setIsClearingCompleted(false);
				}}
			/>

			<AlertDialog
				isOpen={isDeletingTag}
				onOpenChange={setIsDeletingTag}
				title={`Delete the ${detail.name} tag?`}
				description={`It will be taken off ${detail.progress.total} ${
					detail.progress.total === 1 ? "task" : "tasks"
				}. The tasks themselves are not deleted.`}
				actionLabel="Delete"
				onAction={() => {
					apply({ kind: "tag.delete", tagId: detail.tagId });
					setIsDeletingTag(false);
					void navigate({ to: "/tags" });
				}}
			/>
		</VStack>
	);
}
