import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
	type QuickAddLine,
	QuickAddTask,
} from "#/components/checklists/quick-add-task";
import { StageTabs } from "#/components/checklists/stage-tabs";
import { SelectAllButton } from "#/components/common/arranged-list";
import { ListLoading, LoadingState } from "#/components/common/loading-state";
import { SortMenu } from "#/components/common/sort-menu";
import { ErrorNotice } from "#/components/common/states";
import { TagFilter } from "#/components/tags/tag-filter";
import { GroupByToggle } from "#/components/tasks/group-by-toggle";
import { IndexTaskList } from "#/components/tasks/index-task-list";
import { TypeFilter } from "#/components/tasks/type-filter";
import { MemberFilter } from "#/components/teams/member-filter";
import type { AcrossTask } from "#/data/across.server";
import { getAcrossTasksFn } from "#/functions/across.functions";
import {
	createTasks,
	resolveChecklistName,
	resolveTags,
	resolveTrackerName,
	useApplyChange,
	withNewTags,
} from "#/lib/changes";
import {
	type FilterSearch,
	filterSearch,
	sortParam,
} from "#/lib/filter-search";
import { PAGE_SIZE } from "#/lib/use-pages";
import { useTaskSelection } from "#/lib/use-task-selection";
import { usePermissions } from "#/lib/use-team";
import { acrossQuery } from "#/queries/across";
import { checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { tagsQuery } from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import type { AcrossPageView, GroupBy } from "#/schemas/task";

/** The cut and the page the screen opens on: by stage, newest first. */
const FIRST_VIEW: AcrossPageView = {
	groupBy: "stage",
	sort: "newest",
	limit: PAGE_SIZE,
};

export const Route = createFileRoute("/stages")({
	// The cut, the tab and the page on show, so leaving and coming back —
	// Back, say — lands on the same tab, and the router puts the scroll back.
	validateSearch: (
		search: Record<string, unknown>,
	): { by?: GroupBy; group?: string; page?: number } & FilterSearch => ({
		by: search.by === "type" ? "type" : undefined,
		// The order and filters too; see `filterSearch`.
		...filterSearch(search),
		group: typeof search.group === "string" ? search.group : undefined,
		page:
			typeof search.page === "number" && search.page > 1
				? search.page
				: undefined,
	}),
	loader: async ({ context }) => {
		// Tags colour the rows and light their Today buttons; the checklists say
		// where each task lives, and answer a `&` line typed into quick-add, as
		// the trackers do. None of them is waited for.
		deferQuery(context.queryClient, tagsQuery());
		deferQuery(context.queryClient, trackersQuery());
		deferQuery(context.queryClient, checklistsQuery());

		// The first page of the first group is the screen.
		await primeQuery(context.queryClient, acrossQuery(FIRST_VIEW));
	},
	component: StagesPage,
});

/**
 * Every task across every checklist, cut one way at a time.
 *
 * A checklist's own page shows its stages one at a time. This shows one slice
 * across all of them: one **stage** — everything in review, wherever it is, by
 * name, since the names are what checklists share (`stagesByName`) — or one
 * **type**, every bug whatever list it is in (`tasksByType`).
 *
 * The two are one screen rather than two because they are the same question
 * asked of the same rows, and a switch between them is cheaper to learn than a
 * second entry in the bar that looks the same and is not. A tab strip that
 * changes what it names is the smallest thing that can carry both.
 *
 * The cut, the filters, the order and the page are the server's to answer, as
 * they are on a checklist and on a tag: one group and one page of it come back,
 * with the counts for the tabs over it. Switching any of them asks again,
 * rather than the screen holding every task in the space to slice for itself.
 *
 * Each task is the row a tag's page shows, with the checklist it lives in
 * under the title, so it can be moved on from here, and leaves the list when it
 * is. Tasks can be typed straight in, as on a checklist; one typed here belongs
 * to no list yet, so it goes into the Inbox.
 */
function StagesPage() {
	const navigate = useNavigate();
	const { apply } = useApplyChange();

	const [isClearingDone, setIsClearingDone] = useState(false);
	// Picked by hand, and kept in the URL; until then, by stage, the first
	// group of whichever cut is shown, newest first and unfiltered.
	const {
		by: groupBy = "stage",
		group,
		page,
		sort = "newest",
		who: assignee,
		tag: tagId,
		type: typeId,
	} = Route.useSearch();

	/**
	 * Show another cut, tab or page. It replaces the address rather than adding
	 * to it, so Back leaves the screen instead of going through every tab, and
	 * keeps the scroll where it is, as a tab does.
	 */
	function show(
		next: { by?: GroupBy; group?: string; page?: number } & FilterSearch,
	) {
		void navigate({
			to: ".",
			search: (previous) => ({ ...previous, ...next }),
			replace: true,
			resetScroll: false,
		});
	}
	const setPage = (next: number | undefined) => show({ page: next });
	const { canManageContent, canUpdateTasks } = usePermissions();
	// The rows picked out; see `IndexTaskList`.
	const selection = useTaskSelection();

	// Cut by type, the tabs are already the type filter, so only the other two
	// narrow the rows then.
	const shownType = groupBy === "stage" ? typeId : undefined;

	/*
	 * One group, one page of it. The rows on screen stay up while another
	 * group, order or page is on its way, as on a checklist's screen.
	 */
	const result = useQuery({
		...acrossQuery({
			groupBy,
			group,
			sort,
			limit: PAGE_SIZE,
			page,
			assignee,
			tag: tagId,
			type: shownType,
		}),
		placeholderData: keepPreviousData,
	});

	const tagsResult = useQuery(tagsQuery());
	const trackersResult = useQuery(trackersQuery());
	const checklistsResult = useQuery(checklistsQuery());

	const tags = tagsResult.data ?? [];
	const trackers = trackersResult.data ?? [];
	const checklists = checklistsResult.data ?? [];

	/** Another order or filter: a different list, so from its first page. */
	const filterBy = (next: FilterSearch) => show({ page: undefined, ...next });

	if (result.isError) {
		return (
			<VStack gap={4}>
				<Heading level={1}>Across lists</Heading>
				<ErrorNotice
					error={result.error}
					onRetry={() => void result.refetch()}
				/>
			</VStack>
		);
	}

	const data = result.data ?? null;
	const shown = data?.groups.find((each) => each.key === data.key) ?? null;

	/*
	 * A done tab: the stage finished tasks are at, where they can all be
	 * deleted at once. Deleting them is shaping the work; see `Capability`.
	 */
	const isDoneTab =
		groupBy === "stage" &&
		data !== null &&
		data.items.length > 0 &&
		data.items.every((task) => task.completed);
	const canClearDone = isDoneTab && canManageContent;

	/**
	 * Delete every finished task in the tab shown, not only the page on screen.
	 * The page goes first, in one batch, without waiting; then the whole tab is
	 * read and the rest follows in a second. That read goes straight to the
	 * server rather than through the cache: every change drawn above cancels
	 * the queries in flight.
	 */
	async function clearDone() {
		if (data === null) return;
		const deleted = new Set<string>();
		const remove = (tasks: ReadonlyArray<AcrossTask>) => {
			const taskIds = tasks
				.filter((task) => task.completed && !deleted.has(task.taskId))
				.map((task) => task.taskId);
			if (taskIds.length === 0) return;
			for (const taskId of taskIds) deleted.add(taskId);
			apply({ kind: "task.deleteMany", taskIds });
		};

		remove(data.items);
		const all = await getAcrossTasksFn({
			data: {
				groupBy,
				group: data.key,
				sort,
				limit: 10_000,
				page: 1,
				assignee,
				tag: tagId,
				type: shownType,
			},
		});
		remove(all.items);
	}

	/**
	 * Add a pasted block of tasks. Belonging to no list yet, they go into the
	 * Inbox; see `ensureInbox`. One resolver for the whole block, so a tag
	 * written on three lines is created once rather than three times.
	 */
	function addTasks(lines: Array<QuickAddLine>) {
		const inputs = withNewTags(apply, tags, canManageContent, (resolveTag) =>
			lines.map((line) => {
				// A line naming a tracker or a checklist becomes a task that follows
				// it, titled with its own title. A name matching nothing stays text.
				const tracker = resolveTrackerName(trackers, line.trackerName);
				const linked = tracker
					? null
					: resolveChecklistName(checklists, line.trackerName);

				return {
					title: tracker?.title ?? linked?.title ?? line.title,
					tagIds:
						tracker || linked ? [] : resolveTags(resolveTag, line.tagNames),
					trackerId: tracker?.trackerId ?? null,
					linkedChecklistId: linked?.checklistId ?? null,
					urgent: line.urgent,
					important: line.important,
					deadline: line.deadline,
					deadlineTime: line.deadlineTime,
				};
			}),
		);

		createTasks(apply, null, inputs);
	}

	return (
		<VStack gap={4}>
			<VStack gap={0.5}>
				<Heading level={1}>Across lists</Heading>
				<Text color="secondary">
					Every task by the stage it is at, or by what kind of work it is,
					whichever checklist it is in.
				</Text>
			</VStack>

			{/* Adding a task is shaping the work; see `Capability`. */}
			{canManageContent ? (
				<QuickAddTask
					placeholder="Add a task to the Inbox — #tag it, &track it, -deadline tomorrow, or paste a list"
					tags={tags}
					trackers={trackers}
					checklists={checklists}
					onAdd={addTasks}
				/>
			) : null}

			{data === null ? (
				<LoadingState />
			) : shown === null ? (
				/* No checklist has a stage and the space has no types: nothing to cut. */
				<EmptyState
					title="Nothing to show yet."
					description="Tasks show up here once there is a checklist to put them in."
				/>
			) : (
				<VStack gap={2}>
					{/* The cut and the filters, then the order — as a checklist has it. */}
					<HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
						<HStack gap={1} vAlign="center" wrap="wrap">
							<GroupByToggle
								value={groupBy}
								onChange={(next) =>
									// The groups are named differently now, so whatever was
									// picked under the old cut no longer means anything.
									show({
										by: next === "stage" ? undefined : next,
										group: undefined,
										page: undefined,
									})
								}
							/>
							<MemberFilter
								value={assignee}
								onChange={(who) => filterBy({ who })}
							/>
							<TagFilter
								tags={tags}
								value={tagId}
								onChange={(tag) => filterBy({ tag })}
							/>
							{groupBy === "stage" ? (
								<TypeFilter
									value={typeId}
									onChange={(type) => filterBy({ type })}
								/>
							) : null}
						</HStack>
						<HStack gap={1} vAlign="center">
							{canUpdateTasks ? (
								<SelectAllButton onClick={selection.pickAll} />
							) : null}
							<SortMenu
								order={sort}
								// One stage at a time when that is the cut; by type a group
								// gathers tasks from every stage there is.
								hasStageOrder={groupBy === "type"}
								onChange={(next) => filterBy({ sort: sortParam(next) })}
							/>
						</HStack>
					</HStack>

					{canClearDone ? (
						<HStack hAlign="end">
							<Button
								label={`Delete all ${shown.name.toLowerCase()}`}
								icon={<Trash2 aria-hidden />}
								variant="ghost"
								className="thunderlist-list-action"
								size="sm"
								onClick={() => setIsClearingDone(true)}
							/>
						</HStack>
					) : null}

					<StageTabs
						stages={data.groups.map((each) => ({
							stageId: each.key,
							name: each.name,
						}))}
						value={data.key}
						counts={Object.fromEntries(
							data.groups.map((each) => [each.key, each.count]),
						)}
						onChange={(key) => {
							show({ group: key, page: undefined });
						}}
					/>

					<ListLoading
						isLoading={result.isPlaceholderData}
						isEmpty={data.items.length === 0}
					>
						{data.items.length === 0 ? (
							<EmptyState
								isCompact
								title={`Nothing in ${shown.name}.`}
								description={
									groupBy === "stage"
										? `Tasks at ${shown.name}, in any checklist, show up here.`
										: "Tasks of this kind, in any checklist, show up here."
								}
							/>
						) : (
							<IndexTaskList
								tasks={data.items}
								page={data.page}
								total={data.total}
								onPageChange={setPage}
								isStageShown={false}
								selection={selection}
							/>
						)}
					</ListLoading>
				</VStack>
			)}

			<AlertDialog
				isOpen={isClearingDone}
				onOpenChange={setIsClearingDone}
				title={`Delete ${shown?.count ?? 0} ${shown?.name.toLowerCase() ?? "done"} ${shown?.count === 1 ? "task" : "tasks"}?`}
				description="They will be deleted from every checklist they live in."
				actionLabel="Delete"
				onAction={() => {
					void clearDone();
					setIsClearingDone(false);
				}}
			/>
		</VStack>
	);
}
