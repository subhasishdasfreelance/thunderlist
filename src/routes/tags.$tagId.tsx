import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useIsFetching, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
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
import { SPECIAL_TAG_ICONS } from "#/components/tags/special-tag-icons";
import { TagFormDialog } from "#/components/tags/tag-form-dialog";
import { TrackerCard } from "#/components/trackers/tracker-card";
import {
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
	formatDateWithWeekday,
	formatDeadline,
	formatSchedule,
} from "#/lib/format-date";
import { computeVelocity, localMoment, todayWindow } from "#/lib/progress";
import { type ParsedTitle, withInlineTag } from "#/lib/tags/inline-tags";
import {
	compareTasks,
	mergeReads,
	type SortOrder,
	sortTasksBy,
} from "#/lib/tasks/tasks";
import { useFocusTask } from "#/lib/use-focus-task";
import { useNow } from "#/lib/use-now";
import { paceAt } from "#/lib/use-pace";
import { useShowMore } from "#/lib/use-show-more";
import { useWhenIdle } from "#/lib/use-when-idle";
import { checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { tagCompletedQuery, tagQuery, tagsQuery } from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import { todayDateOnly } from "#/schemas/common";
import { type TagTaskEntry, tagStartDate } from "#/schemas/tag";
import type { Task } from "#/schemas/task";

export const Route = createFileRoute("/tags/$tagId")({
	/** `?task=` names a task to scroll to and ring; see `useFocusTask`. */
	validateSearch: (search: Record<string, unknown>) => ({
		task: typeof search.task === "string" ? search.task : undefined,
	}),
	loader: ({ context, params }) => {
		// Every tag, for the highlights in the titles, Today's bolt and the name
		// check when editing; the trackers and checklists, for a `&` line typed
		// into quick-add. None of them is waited for.
		deferQuery(context.queryClient, tagsQuery());
		deferQuery(context.queryClient, trackersQuery());
		deferQuery(context.queryClient, checklistsQuery());

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
 * Tasks can be typed straight in, as on a checklist. One typed here belongs to
 * no checklist and carries this tag, written at the end of its title — which
 * is how Today, a tag like any other, gets filled in.
 */
function TagDetailPage() {
	const { tagId } = Route.useParams();
	const { task: focusTaskId } = Route.useSearch();
	const navigate = useNavigate();
	const { apply } = useApplyChange();

	const [renaming, setRenaming] = useState<Task | null>(null);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
	const [isDeletingTag, setIsDeletingTag] = useState(false);
	const [isClearingCompleted, setIsClearingCompleted] = useState(false);
	const [sort, setSort] = useState<SortOrder>("newest");
	const [wantsCompleted, setWantsCompleted] = useState(false);

	const { data, isError, error, refetch } = useQuery(tagQuery(tagId));

	/*
	 * The finished tasks are read last: once everything else on the screen has
	 * arrived and the browser has a moment to spare — or straight away, if the
	 * Completed section is opened before then.
	 */
	const fetching = useIsFetching();
	const isSettled = useWhenIdle(data !== undefined && fetching === 0);
	const completedResult = useQuery({
		...tagCompletedQuery(tagId),
		enabled: isSettled || wantsCompleted,
	});
	const tagsResult = useQuery(tagsQuery());
	const trackersResult = useQuery(trackersQuery());
	const checklistsResult = useQuery(checklistsQuery());

	const detail = data ?? null;

	// The open tasks come with the tag and the finished ones after it; the screen
	// sorts the two together.
	const allEntries = useMemo(
		() =>
			mergeReads(
				detail?.tasks ?? [],
				completedResult.data ?? [],
				(entry) => entry.task.taskId,
			),
		[detail, completedResult.data],
	);

	const rows = useMemo(
		() =>
			sortTasksBy(
				allEntries.map((entry) => ({
					entry,
					urgent: entry.task.urgent,
					important: entry.task.important,
				})),
				sort,
				(a, b) => compareTasks(a.entry.task, b.entry.task),
			).map((row) => row.entry),
		[allEntries, sort],
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

	// Twenty rows at a time, but never hiding the row a `?task=` link was sent to.
	const openPaging = useShowMore(
		open,
		open.findIndex((entry) => entry.task.taskId === focusTaskId),
	);
	const completedPaging = useShowMore(
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

	const { progress } = detail;
	const startDate = tagStartDate(detail);
	const daily = detail.dailyWindow ?? null;
	// The progress counts trackers too, one each; the Completed section lists
	// only tasks.
	const finishedTrackers = detail.trackers.filter(
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

	const velocity = computeVelocity({
		startDate,
		deadline: detail.deadline,
		current: progress.completed,
		target: progress.total,
	});

	const Mark =
		detail.special === null ? null : SPECIAL_TAG_ICONS[detail.special];

	/**
	 * Add a pasted block of tasks, each carrying this tag.
	 *
	 * One resolver for the whole block, so a tag written on three lines is
	 * created once rather than three times.
	 */
	function addTasks(lines: Array<ParsedTitle>) {
		if (detail === null) return;
		const resolveTag = createTagResolver(apply, tags);

		for (const line of lines) {
			// A line naming a tracker or a checklist becomes a task that follows
			// it, titled with its own title. A name matching nothing stays text.
			const tracker = resolveTrackerName(trackers, line.trackerName);
			const linked = tracker
				? null
				: resolveChecklistName(checklists, line.trackerName);
			const written = tracker || linked ? [] : line.tagNames.map(resolveTag);

			createTask(apply, {
				checklistId: null,
				title: withInlineTag(
					tracker?.title ?? linked?.title ?? line.title,
					detail.name,
				),
				tagIds: [...new Set([...written, detail.tagId])],
				trackerId: tracker?.trackerId ?? null,
				linkedChecklistId: linked?.checklistId ?? null,
			});
		}
	}

	/*
	 * Clearing the finished tasks off Today or the Backlog only untags them:
	 * those are plans, and each task lives wherever it lives. The exception is
	 * a task in no checklist with no other tag — this tag is all it has, so it
	 * is deleted rather than left where nothing shows it. Any other tag's page
	 * deletes them all, as a checklist's does.
	 */
	const special = detail.special;
	const isOnlyHere = (entry: TagTaskEntry) =>
		entry.checklistId === null && entry.task.tagIds.length === 1;
	const clearedOff = completed.filter((entry) => !isOnlyHere(entry)).length;
	const deletedOnClear = completed.length - clearedOff;

	function clearCompleted() {
		for (const entry of completed) {
			if (special === null || isOnlyHere(entry)) {
				apply({ kind: "task.delete", taskId: entry.task.taskId });
			} else {
				setSpecialTag(apply, entry.task, special, false, tags);
			}
		}
	}

	const clearDescription =
		special === null
			? "They will be deleted from wherever they live."
			: [
					clearedOff === 0
						? null
						: `${clearedOff === 1 ? "1 task is" : `${clearedOff} tasks are`} only taken off #${detail.name}.`,
					deletedOnClear === 0
						? null
						: `${deletedOnClear === 1 ? "1 task belongs" : `${deletedOnClear} tasks belong`} to no checklist and no other tag, so ${deletedOnClear === 1 ? "it is" : "they are"} deleted.`,
				]
					.filter((line) => line !== null)
					.join(" ");

	/** One task row, used by both the open and the completed sections. */
	const taskRow = ({ task, checklistId, checklistTitle }: TagTaskEntry) => (
		<TaskRow
			task={task}
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
				onSetSpecial: (kind, isOn) =>
					setSpecialTag(apply, task, kind, isOn, tags),
				onSetUrgent: (urgent) => updateTask(apply, task.taskId, { urgent }),
				onSetImportant: (important) =>
					updateTask(apply, task.taskId, { important }),
				onRename: () => setRenaming(task),
				onDelete: () => setPendingDelete(task),
			}}
		/>
	);

	// Today's page says which day it is, as the Today screen always did.
	const subtitle =
		special === "today"
			? formatDateWithWeekday(todayDateOnly())
			: detail.description;

	return (
		<VStack gap={4}>
			<BackButton to="/tags" label="Tags" />

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
			{detail.trackers.length === 0 ? null : (
				<VStack gap={2}>
					<Text type="label" weight="semibold" color="secondary">
						Trackers
					</Text>
					{detail.trackers.map(({ tracker }) => (
						<TrackerCard
							key={tracker.trackerId}
							tracker={tracker}
							tags={tags}
						/>
					))}
				</VStack>
			)}

			<QuickAddTask
				tags={tags}
				trackers={trackers}
				checklists={checklists}
				onAdd={addTasks}
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
				detail.trackers.length === 0 ? (
					<EmptyState
						title="Nothing carries this tag yet."
						description={
							special === "today"
								? "Type a task above, or press the bolt on any task."
								: `Type a task above, or write #${detail.name} in one.`
						}
					/>
				) : null
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
								data-task-id={entry.task.taskId}
								data-focused={entry.task.taskId === focusTaskId}
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
				count={progress.completed - finishedTrackers}
				clearLabel={
					special === null
						? "Delete all completed"
						: `Clear from #${detail.name}`
				}
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
							start={todays?.start ?? dayStart(startDate)}
							end={
								todays?.end ?? localMoment(detail.deadline, detail.deadlineTime)
							}
							now={now}
							target={progress.total}
							current={progress.completed}
							points={completionPoints(
								[
									...allEntries.map((entry) => entry.task),
									// A tracker is done on the day it reached its target.
									...detail.trackers.map(({ tracker, completedOn }) => ({
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
				{completedResult.isError ? (
					<ErrorNotice
						error={completedResult.error}
						onRetry={() => void completedResult.refetch()}
					/>
				) : completedResult.data === undefined ? (
					<SectionSpinner label="Loading completed tasks…" />
				) : (
					<>
						{completedPaging.shown.map((entry, index) => (
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
				title={
					special === null
						? `Delete ${completed.length} completed ${completed.length === 1 ? "task" : "tasks"}?`
						: `Clear ${completed.length} completed from #${detail.name}?`
				}
				description={clearDescription}
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
				description={`It will be taken off ${progress.total} ${
					progress.total === 1 ? "task" : "tasks"
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
