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
import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	Megaphone,
	MoreHorizontal,
	Pencil,
	TagX,
	Trash2,
	ZapOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChecklistPickerDialog } from "#/components/checklists/checklist-picker-dialog";
import {
	type QuickAddLine,
	QuickAddTask,
} from "#/components/checklists/quick-add-task";
import { TaskRenameDialog } from "#/components/checklists/task-rename-dialog";
import { TaskRow } from "#/components/checklists/task-row";
import { BackButton } from "#/components/common/back-button";
import { CompletedSection } from "#/components/common/completed-section";
import { DayStats } from "#/components/common/day-stats";
import { numberTitle } from "#/components/common/item-number";
import { ListPagination } from "#/components/common/list-pagination";
import { ListLoading, LoadingState } from "#/components/common/loading-state";
import { PaceLabel } from "#/components/common/pace-label";
import { ProgressChart } from "#/components/common/progress-chart";
import {
	formatExpectedTasks,
	ProgressMeter,
} from "#/components/common/progress-meter";
import { SectionSpinner } from "#/components/common/section-spinner";
import { SortMenu } from "#/components/common/sort-menu";
import { ErrorNotice } from "#/components/common/states";
import { VelocityStats } from "#/components/common/velocity-stats";
import { SPECIAL_TAG_ICONS } from "#/components/tags/special-tag-icons";
import { StageFilter } from "#/components/tags/stage-filter";
import { TagFormDialog } from "#/components/tags/tag-form-dialog";
import { TagTasks } from "#/components/tags/tag-tasks";
import { SelectionBar } from "#/components/tasks/selection-bar";
import { TaskTypeDialog } from "#/components/tasks/task-type-dialog";
import { TasksEditDialog } from "#/components/tasks/tasks-edit-dialog";
import { TypeFilter } from "#/components/tasks/type-filter";
import { AccessButton } from "#/components/teams/access-button";
import { AssignDialog } from "#/components/teams/assign-dialog";
import { MemberFilter } from "#/components/teams/member-filter";
import { MessageDialog } from "#/components/teams/message-dialog";
import { TrackerCard } from "#/components/trackers/tracker-card";
import {
	getTagCompletedFn,
	getTagOpenTasksFn,
} from "#/functions/tag.functions";
import {
	applyBatched,
	assignAlike,
	createTagResolver,
	createTasks,
	moveAllToStage,
	moveManyToBacklog,
	moveToBacklog,
	resolveChecklistName,
	resolveTags,
	resolveTrackerName,
	setSpecialTag,
	setTag,
	setTypeOnAll,
	toggleAssignee,
	toggleAssigneeOnAll,
	toggleFlagOnAll,
	toggleSpecialTagOnAll,
	updateAllAlike,
	updateTask,
	useApplyChange,
} from "#/lib/changes";
import { completionPoints, dayStart } from "#/lib/chart-points";
import {
	type FilterSearch,
	filterSearch,
	sortParam,
} from "#/lib/filter-search";
import {
	formatClock,
	formatDate,
	formatDeadline,
	formatSchedule,
} from "#/lib/format-date";
import { emptyTagPage } from "#/lib/optimistic";
import { computeVelocity, localMoment, todayWindow } from "#/lib/progress";
import { withInlineTag } from "#/lib/tags/inline-tags";
import {
	matchesFilter,
	mergeReads,
	orderByTask,
	shortTitle,
} from "#/lib/tasks/tasks";
import { useArrival, useFocusTask } from "#/lib/use-focus-task";
import { useHeld } from "#/lib/use-held";
import { useNow } from "#/lib/use-now";
import { paceAt } from "#/lib/use-pace";
import { firstPage, PAGE_SIZE, usePages } from "#/lib/use-pages";
import { useTaskSelection } from "#/lib/use-task-selection";
import { useTaskTypes } from "#/lib/use-task-types";
import { useItemPermissions, useSpace } from "#/lib/use-team";
import { checklistsQuery } from "#/queries/checklists";
import { queryKeys } from "#/queries/keys";
import { deferQuery, primeQuery } from "#/queries/prime";
import {
	tagCompletedQuery,
	tagForQuery,
	tagOpenQuery,
	tagQuery,
	tagsQuery,
} from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import {
	checklistStages,
	nextStageId,
	sharedStages,
	specialChecklist,
	stageProgress,
} from "#/schemas/checklist";
import { todayDateOnly } from "#/schemas/common";
import { type TagTaskEntry, tagStageParts, tagStartDate } from "#/schemas/tag";
import type { Task, TaskFilter, TaskPageView } from "#/schemas/task";
import { memberName } from "#/schemas/team";

/** A tag's open tasks a thousand at a time, for clearing a tag in one go. */
const ALL_OPEN: TaskPageView = { sort: "newest", limit: 1000 };

export const Route = createFileRoute("/tags/$tagId")({
	/**
	 * `?task=` names a task to scroll to and ring; see `useFocusTask`. The
	 * order and filters are kept here too, `?stage=` the name of the one stage
	 * shown; see `filterSearch`.
	 */
	validateSearch: (
		search: Record<string, unknown>,
	): { task: string | undefined; stage?: string } & FilterSearch => ({
		task: typeof search.task === "string" ? search.task : undefined,
		...filterSearch(search),
		// Not `searchText`: "To do" is the empty key (`NOT_STARTED_STAGE_KEY`),
		// and reading `?stage=` as no stage showed every stage instead.
		stage: typeof search.stage === "string" ? search.stage : undefined,
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
	// Picked by hand, and kept in the URL; until then newest first, unfiltered.
	const {
		task: focusTaskId,
		sort = "newest",
		who: assignee,
		type: typeId,
		stage: stageName,
	} = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { apply, applyAsync } = useApplyChange();
	const space = useSpace();
	const team = space?.team ?? null;

	const [renaming, setRenaming] = useState<Task | null>(null);
	// Every task picked out, edited together; see `TasksEditDialog`.
	const [editingMany, setEditingMany] = useState<ReadonlyArray<Task> | null>(
		null,
	);
	// The tasks a move is being picked for: one from its own menu, or every
	// task picked out at once; see `SelectionBar`.
	const [moving, setMoving] = useState<ReadonlyArray<TagTaskEntry> | null>(
		null,
	);
	const [typing, setTyping] = useState<ReadonlyArray<Task> | null>(null);
	// The tasks a tag is being put on: the one pointed at, or every one
	// picked out; see `TagPickerDialog`.
	const [tagging, setTagging] = useState<ReadonlyArray<Task> | null>(null);
	// The tasks being given to people: the one pointed at, or every one
	// picked out; see `AssignDialog`.
	const [assigning, setAssigning] = useState<ReadonlyArray<Task> | null>(null);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
	const [isDeletingTag, setIsDeletingTag] = useState(false);
	// The tasks picked out to delete, asked about first; see `SelectionBar`.
	const [deletingPicked, setDeletingPicked] =
		useState<ReadonlyArray<string> | null>(null);
	const shownDeletingPicked = useHeld(deletingPicked);
	const [isMessaging, setIsMessaging] = useState(false);
	const [isClearingCompleted, setIsClearingCompleted] = useState(false);
	// Taking the tag off every task on it, asked about first; see `clearTag`.
	const [isClearingTag, setIsClearingTag] = useState(false);
	// Picked by hand; until then, the page `?task=` is on, or the first.
	const [page, setPage] = useState<number | undefined>(undefined);
	const [wantsCompleted, setWantsCompleted] = useState(false);

	/*
	 * Sent to a task on this page while already here — from search, say — the
	 * page goes back to where `?task=` would have opened it. The link carries
	 * no filters, so none is left hiding it.
	 */
	const arrival = useArrival();
	// biome-ignore lint/correctness/useExhaustiveDependencies: every arrival, the same task again included; see `useArrival`.
	useEffect(() => {
		if (focusTaskId === undefined) return;
		setPage(undefined);
	}, [arrival, focusTaskId]);

	/**
	 * Another order or filter: a different list, so from its first page. It
	 * replaces the address rather than adding to it, so Back leaves the screen
	 * rather than stepping back through every filter, and the scroll stays.
	 */
	function filterBy(next: FilterSearch & { stage?: string }) {
		setPage(undefined);
		void navigate({
			to: ".",
			search: (previous) => ({ ...previous, task: undefined, ...next }),
			replace: true,
			resetScroll: false,
		});
	}

	const filter: TaskFilter = { assignee, type: typeId };
	const isFiltered = assignee !== undefined || typeId !== undefined;

	const { data, isError, error, refetch } = useQuery(tagQuery(tagId));
	// The same figures, counting only what the filter lets through.
	const filteredResult = useQuery({
		...tagForQuery(tagId, filter),
		enabled: isFiltered,
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
			type: typeId,
			stageName,
		}),
		placeholderData: keepPreviousData,
	});

	// The finished tasks are read once their section is opened, and not before
	// — or at once for a tag paced daily, whose speed is measured from when
	// they were finished; see `DayStats`.
	const completedResult = useQuery({
		...tagCompletedQuery(tagId),
		enabled: wantsCompleted || data?.dailyWindow != null,
	});
	const tagsResult = useQuery(tagsQuery());
	const trackersResult = useQuery(trackersQuery());
	const checklistsResult = useQuery(checklistsQuery());
	// The space's kinds of work: what the type filter offers, and the order
	// ordering by type follows.
	const types = useTaskTypes();

	const detail = data ?? null;

	/*
	 * What this person may do with this one thing: their role, narrowed by its
	 * access list; see `useItemPermissions`. While it is still loading nothing
	 * is held back, as elsewhere — the screen is a spinner until it arrives.
	 */
	const { canManageContent, canUpdateTasks } = useItemPermissions(
		detail?.access,
	);

	// Ticked on screen, a task stays in the open read until the refetch; it is
	// drawn with the finished ones from the moment it is ticked.
	const open = useMemo(
		() =>
			orderByTask(
				openResult.data?.items ?? [],
				sort,
				(entry) => entry.task,
				(entry) =>
					stageProgress(
						entry.task,
						checklistStages(
							checklistsResult.data?.find(
								(checklist) => checklist.checklistId === entry.checklistId,
							) ?? {},
						),
					),
				types,
			).filter((entry) => !entry.task.completed),
		[openResult.data, sort, checklistsResult.data, types],
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
				undefined,
				types,
			).filter(
				(entry) =>
					entry.task.completed &&
					matchesFilter(entry.task, { assignee, type: typeId }),
			),
		[openResult.data, completedResult.data, sort, assignee, typeId, types],
	);

	/*
	 * A task sent to that is not among the open ones is a finished one: its
	 * section is read and opened, so it can be seen and worked; see
	 * `CompletedSection`.
	 */
	const isRevealingCompleted =
		focusTaskId !== undefined &&
		openResult.data !== undefined &&
		!openResult.isPlaceholderData &&
		!open.some((entry) => entry.task.taskId === focusTaskId);
	useEffect(() => {
		if (isRevealingCompleted) setWantsCompleted(true);
	}, [isRevealingCompleted]);

	// Twenty rows a page, opening on the one a `?task=` link was sent to.
	const completedPages = usePages(
		completed,
		completed.findIndex((entry) => entry.task.taskId === focusTaskId),
	);
	// A page picked by hand earlier would keep it off screen; see the arrival
	// effect above.
	// biome-ignore lint/correctness/useExhaustiveDependencies: every arrival, the same task again included; see `useArrival`.
	useEffect(() => {
		if (focusTaskId !== undefined) completedPages.reset();
	}, [arrival, focusTaskId]);

	/*
	 * Its last task taken off, the tag is deleted; see `deleteUnusedTags`. Once
	 * the server says so — gone from the list of tags too, so a read that only
	 * failed is not taken for it — the screen goes back to the Tags.
	 */
	const isGone =
		isError &&
		detail !== null &&
		tagsResult.isSuccess &&
		!tagsResult.isFetching &&
		!tagsResult.data.some((tag) => tag.tagId === detail.tagId);
	useEffect(() => {
		if (isGone) void navigate({ to: "/tags", replace: true });
	}, [isGone, navigate]);

	const tags = tagsResult.data ?? [];
	const trackers = trackersResult.data ?? [];
	const checklists = checklistsResult.data ?? [];
	// Somewhere to park a task; see `moveToBacklog`.
	const backlog = specialChecklist(checklists, "backlog");

	// What the confirmations say, kept while they close; see `useHeld`.
	const shownDelete = useHeld(pendingDelete);
	const shownCompletedCount = useHeld(
		isClearingCompleted ? completed.length : null,
	);
	const shownClearTotal = useHeld(
		isClearingTag ? (data?.progress.total ?? null) : null,
	);

	useFocusTask(focusTaskId);
	const now = useNow();
	// The rows a text selection runs across, to be moved on together.
	const { picked, clear } = useTaskSelection();

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

	// What the figures count: everything, or only what the filter lets through.
	const figures = isFiltered ? (filteredResult.data ?? detail) : detail;
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
	// What the chart and today's speed are drawn from: the finished tasks, and
	// the trackers, each done on the day it reached its target.
	const finished = [
		...completed.map((entry) => entry.task),
		...figures.trackers.map(({ tracker, completedOn }) => ({
			taskId: tracker.trackerId,
			completed: tracker.progress.percent >= 100,
			completedAt:
				completedOn === null
					? null
					: new Date(dayStart(completedOn)).toISOString(),
		})),
	];

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

	// Who and what the figures are narrowed to, said under them. A kind of work
	// is a task's, so narrowing to one leaves this tag's trackers out; see
	// `getTag`.
	const person = team?.members.find((member) => member.email === assignee);
	const chosenType = types.find((type) => type.typeId === typeId);
	const filterNote = isFiltered
		? `Counting only ${[
				assignee === undefined
					? null
					: `${person === undefined ? assignee : memberName(person)}'s work`,
				typeId === undefined
					? null
					: chosenType === undefined
						? "tasks with no type"
						: `${chosenType.name.toLowerCase()} tasks`,
			]
				.filter((part) => part !== null)
				.join(", ")}.`
		: null;

	/** Where a task lives, and the stages it goes through there. */
	const stagesFor = (checklistId: string | null) =>
		checklistStages(
			checklists.find((checklist) => checklist.checklistId === checklistId) ??
				{},
		);

	// Only someone who can move a task on has anything to do with a pick; the
	// finished ones can be picked too, once their section is open.
	const pickedEntries = canUpdateTasks
		? [...open, ...completedPages.shown].filter((entry) =>
				picked.has(entry.task.taskId),
			)
		: [];
	const pickedTasks = pickedEntries.map((entry) => entry.task);
	// Every picked task parked, but those in the Backlog already.
	const parkable =
		backlog === null || !canManageContent
			? []
			: pickedEntries.flatMap((entry) =>
					entry.checklistId === backlog.checklistId ? [] : [entry.task],
				);
	const isFinishable = (task: Task) =>
		!task.completed && task.trackerId == null && task.linkedChecklistId == null;

	/** What the move dialog says it is about: the one task, or how many. */
	const movingSubtitle =
		moving === null
			? undefined
			: moving.length === 1
				? moving[0].task.title
				: `${moving.length} tasks`;

	/*
	 * Where the picked tasks can go: every checklist but the one they are all
	 * already in. A tag gathers tasks from several, and then every checklist is
	 * somewhere at least one of them can move to.
	 */
	const moveTargets =
		moving === null
			? checklists
			: checklists.filter(
					(checklist) =>
						!moving.every(
							(entry) => entry.checklistId === checklist.checklistId,
						),
				);

	/** Every picked task on to the next stage of its own checklist. */
	function moveOn() {
		applyBatched(apply, (collect) => {
			for (const { task, checklistId } of pickedEntries) {
				const next = nextStageId(task, stagesFor(checklistId));
				if (next !== null) updateTask(collect, task.taskId, { stageId: next });
			}
		});
		clear();
	}

	// The stages to move them to, where every one's checklist has the same.
	const pickedStages =
		sharedStages(
			pickedEntries.map(({ checklistId }) => stagesFor(checklistId)),
		) ?? undefined;

	/** Every picked task to one stage of its checklist's; see `sharedStages`. */
	function moveTo(target: string) {
		moveAllToStage(
			apply,
			pickedEntries.map(({ task, checklistId }) => ({
				task,
				stages: stagesFor(checklistId),
			})),
			target,
		);
		clear();
	}

	/** Every picked task done that can be made done by hand. */
	function finish() {
		applyBatched(apply, (collect) => {
			for (const { task } of pickedEntries) {
				if (isFinishable(task)) {
					updateTask(collect, task.taskId, { completed: true });
				}
			}
		});
		clear();
	}

	/**
	 * Add a pasted block of tasks, each carrying this tag.
	 *
	 * One resolver for the whole block, so a tag written on three lines is
	 * created once rather than three times.
	 */
	function addTasks(lines: Array<QuickAddLine>) {
		if (detail === null) return;
		const resolveTag = createTagResolver(apply, tags, canManageContent);

		const inputs = lines.map((line) => {
			// A line naming a tracker or a checklist becomes a task that follows
			// it, titled with its own title. A name matching nothing stays text.
			const tracker = resolveTrackerName(trackers, line.trackerName);
			const linked = tracker
				? null
				: resolveChecklistName(checklists, line.trackerName);
			const written =
				tracker || linked ? [] : resolveTags(resolveTag, line.tagNames);

			return {
				title: withInlineTag(
					tracker?.title ?? linked?.title ?? line.title,
					detail.name,
				),
				tagIds: [...new Set([...written, detail.tagId])],
				trackerId: tracker?.trackerId ?? null,
				linkedChecklistId: linked?.checklistId ?? null,
				urgent: line.urgent,
				important: line.important,
				deadline: line.deadline,
				deadlineTime: line.deadlineTime,
			};
		});

		// No checklist: they go into the Inbox; see `ensureInbox`.
		createTasks(apply, null, inputs);
	}

	const special = detail.special;

	/* A tag's page deletes its finished tasks, as a checklist's does. */
	function clearCompleted() {
		if (completed.length === 0) return;
		apply({
			kind: "task.deleteMany",
			taskIds: completed.map((entry) => entry.task.taskId),
		});
	}

	/**
	 * The tag taken off every task on it, open and done alike — on Today, the
	 * day started afresh. Each stays in its checklist, and each is untagged the
	 * way the tag picker (or Today's bolt) would, so it is drawn at once.
	 *
	 * The tag's figures and lists are emptied first, all at once; see
	 * `emptyTagPage`. The screen holds only a page of the tag, so the whole of
	 * it is then read, and every task on it untagged together. That read goes
	 * straight to the server rather than through the cache: every change drawn
	 * above cancels the queries in flight.
	 */
	async function clearTag() {
		if (detail === null) return;
		const tag = detail;
		const onScreen = [
			...(openResult.data?.items ?? []),
			...(completedResult.data ?? []),
		];
		// A read of the tag landing after this would put the tasks back.
		await queryClient.cancelQueries({ queryKey: queryKeys.tag(tagId) });
		emptyTagPage(queryClient, tagId);

		// All in one change; see `applyBatched`.
		const cleared = new Set<string>();
		const untag = (entries: ReadonlyArray<TagTaskEntry>) =>
			applyBatched(apply, (collect) => {
				for (const { task } of entries) {
					if (cleared.has(task.taskId)) continue;
					cleared.add(task.taskId);
					if (special === null) setTag(collect, task, tag, false);
					else setSpecialTag(collect, task, special, false, tags);
				}
			});

		/*
		 * Every open task on it, a page at a time however many there are — all
		 * read before any is untagged, or each page read would shift under the
		 * untagging of the one before it and skip tasks.
		 */
		const openAll: Array<TagTaskEntry> = [];
		for (let page = 1; ; page++) {
			const read = await getTagOpenTasksFn({
				data: { tagId, ...ALL_OPEN, page },
			});
			openAll.push(...read.items);
			if (page * ALL_OPEN.limit >= read.total) break;
		}
		const doneAll = await getTagCompletedFn({ data: { tagId } });
		untag([...onScreen, ...openAll, ...doneAll]);
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
								title: checklistTitle,
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
					onToggle: (isDone) =>
						updateTask(apply, task.taskId, { completed: isDone }),
					onSetStage: (next) =>
						updateTask(apply, task.taskId, { stageId: next }),
					onSetSpecial: (kind, isOn) =>
						setSpecialTag(apply, task, kind, isOn, tags),
					onSetUrgent: (urgent) => updateTask(apply, task.taskId, { urgent }),
					onSetImportant: (important) =>
						updateTask(apply, task.taskId, { important }),
					onSetType: () => setTyping([task]),
					onAddTag: () => setTagging([task]),
					onRename: () => setRenaming(task),
					onMove: () => setMoving([entry]),
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

	// Today's page says which day it is, as the Today screen always did — on
	// the viewer's clock, so only once the browser has it; see `useNow`.
	const subtitle =
		special === "today"
			? now === null
				? ""
				: formatDate(todayDateOnly(new Date(now)))
			: detail.description;

	const openTotal = openResult.data?.total ?? 0;

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<BackButton to="/tags" label="Tags" />
				{/* Today is everyone's, in a team as anywhere. */}
				{special === null ? (
					<AccessButton
						noun="tag"
						access={detail.access}
						canChange={canManageContent}
						onChange={(access) =>
							apply({
								kind: "tag.update",
								tagId: detail.tagId,
								patch: { access },
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
							// Headed by its number; see `numberTitle`.
							{
								type: "section" as const,
								title: numberTitle("tag", detail.number),
								items: [
									{
										label: "Edit tag",
										icon: Pencil,
										onClick: () => setIsEditOpen(true),
									},
									// A notification to everyone who can see it; see `MessageDialog`.
									...(team === null
										? []
										: [
												{
													label: "Message its people…",
													icon: Megaphone,
													onClick: () => setIsMessaging(true),
												},
											]),
								],
							},
							// Today can be renamed but never deleted: the bolt on every row
							// writes it.
							...(special === null
								? [
										{ type: "divider" as const },
										{
											label: "Delete tag",
											icon: Trash2,
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
						stages={{
							parts: tagStageParts(progress, detail.stageColors),
							total: progress.total,
							// Every stage counted under the bar, the not-started ones too.
							firstName: "To do",
						}}
						elapsed={pace.elapsed}
						expectedReading={
							pace.elapsed == null
								? undefined
								: formatExpectedTasks(pace.elapsed, progress.total)
						}
						footnote={scheduleNote}
					/>
					{filterNote === null ? null : (
						<Text type="supporting">{filterNote}</Text>
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
					finishedAt={
						completedResult.data === undefined
							? undefined
							: finished.flatMap((each) =>
									each.completed ? [each.completedAt] : [],
								)
					}
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

			{/* On a phone, the clear button leaves the filters no room beside it,
			    so the count and the filters take a line each there. */}
			{detail.progress.total === 0 ? null : (
				<div
					className={
						canUpdateTasks
							? "flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
							: "flex flex-row flex-wrap items-center justify-between gap-2"
					}
				>
					<HStack gap={2} vAlign="center">
						<Text type="label" weight="semibold" color="secondary">
							{openTotal} yet to complete
						</Text>
						{canUpdateTasks ? (
							<Button
								label={`Clear #${detail.name}`}
								tooltip={`Take #${detail.name} off every task on it`}
								variant="ghost"
								className="thunderlist-list-action"
								size="sm"
								icon={
									special === "today" ? (
										<ZapOff aria-hidden />
									) : (
										<TagX aria-hidden />
									)
								}
								onClick={() => setIsClearingTag(true)}
							/>
						) : null}
					</HStack>
					{/* Wraps: three labelled menus are wider than a phone. */}
					<HStack gap={1} vAlign="center" wrap="wrap">
						<MemberFilter
							value={assignee}
							onChange={(next) => filterBy({ who: next })}
						/>
						<TypeFilter
							value={typeId}
							onChange={(next) => filterBy({ type: next })}
						/>
						<StageFilter
							stages={(detail.progress.stages ?? []).map((stage) => ({
								...stage,
								color: detail.stageColors?.[stage.key] ?? stage.color,
							}))}
							value={stageName}
							onChange={(next) => filterBy({ stage: next })}
						/>
						<SortMenu
							order={sort}
							hasStageOrder
							onChange={(next) => filterBy({ sort: sortParam(next) })}
						/>
					</HStack>
				</div>
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
			) : (
				<ListLoading
					isLoading={openResult.isPlaceholderData}
					isEmpty={open.length === 0}
				>
					{open.length === 0 ? (
						<EmptyState
							title={
								stageName !== undefined
									? "Nothing at this stage."
									: assignee === undefined
										? "All done."
										: "Nothing to do here."
							}
							description={
								stageName !== undefined
									? "No open task with this tag is at it."
									: assignee === undefined
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
										data-picked={pickedEntries.includes(entry)}
									>
										{index === 0 ? null : <Divider />}
										{taskRow(entry)}
									</div>
								))}
								<ListPagination
									// The page asked for, while it is on its way: the one on
									// screen until then would pull the highlight back.
									page={
										openResult.isPlaceholderData
											? (page ?? openResult.data.page)
											: openResult.data.page
									}
									total={openResult.data.total}
									onChange={setPage}
								/>
							</VStack>
						</Card>
					)}
				</ListLoading>
			)}

			<CompletedSection
				count={progress.completed - finishedTrackers}
				clearLabel="Delete all completed"
				onClear={
					completedResult.data === undefined || !canManageContent
						? undefined
						: () => setIsClearingCompleted(true)
				}
				onOpen={() => setWantsCompleted(true)}
				reveal={isRevealingCompleted ? `${arrival}:${focusTaskId}` : undefined}
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
								finished,
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
								data-picked={pickedEntries.includes(entry)}
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

			{pickedEntries.length === 0 ? null : (
				<SelectionBar
					count={pickedEntries.length}
					onNextStage={
						pickedEntries.some(
							({ task, checklistId }) =>
								nextStageId(task, stagesFor(checklistId)) !== null,
						)
							? moveOn
							: undefined
					}
					stages={pickedStages}
					onMoveTo={moveTo}
					onDone={
						pickedEntries.some(({ task }) => isFinishable(task))
							? finish
							: undefined
					}
					onMoveToChecklist={
						canManageContent ? () => setMoving(pickedEntries) : undefined
					}
					onAddTag={() => setTagging(pickedTasks)}
					onDelete={
						canManageContent
							? () =>
									setDeletingPicked(
										pickedEntries.map((entry) => entry.task.taskId),
									)
							: undefined
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
				subtitle={movingSubtitle}
				checklists={moveTargets}
				isLoading={checklistsResult.isPending}
				onPick={(target) => {
					applyBatched(apply, (collect) => {
						for (const entry of moving ?? []) {
							if (entry.checklistId === target) continue;
							collect({
								kind: "task.move",
								taskId: entry.task.taskId,
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
				stages={detail.progress.stages}
				existingNames={tags.map((tag) => tag.name)}
				onSubmit={(values) => {
					// The address may be `today` rather than the tag's id.
					apply({ kind: "tag.update", tagId: detail.tagId, patch: values });
					setIsEditOpen(false);
				}}
			/>

			<AlertDialog
				isOpen={deletingPicked !== null}
				onOpenChange={(open) => {
					if (!open) setDeletingPicked(null);
				}}
				title={`Delete ${shownDeletingPicked?.length ?? 0} tasks?`}
				description="Every task picked out will be deleted."
				actionLabel="Delete"
				onAction={() => {
					if (deletingPicked) {
						apply({ kind: "task.deleteMany", taskIds: [...deletingPicked] });
					}
					setDeletingPicked(null);
					clear();
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
				isOpen={isClearingCompleted}
				onOpenChange={setIsClearingCompleted}
				title={`Delete ${shownCompletedCount} completed ${shownCompletedCount === 1 ? "task" : "tasks"}?`}
				description="They will be deleted from wherever they live."
				actionLabel="Delete"
				onAction={() => {
					clearCompleted();
					setIsClearingCompleted(false);
				}}
			/>

			<AlertDialog
				isOpen={isClearingTag}
				onOpenChange={setIsClearingTag}
				title={`Clear #${detail.name}?`}
				description={`#${detail.name} is taken off all ${shownClearTotal} ${
					shownClearTotal === 1 ? "task" : "tasks"
				} on it, done or not. They stay in their checklists.`}
				actionLabel="Clear"
				onAction={() => {
					void clearTag();
					setIsClearingTag(false);
				}}
			/>

			<MessageDialog
				isOpen={isMessaging}
				onOpenChange={setIsMessaging}
				from={{ kind: "tag", tagId: detail.tagId }}
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
