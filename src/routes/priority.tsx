import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleAlert, CircleDashed, Flame, Star } from "lucide-react";
import { useState } from "react";
import { type Facet, FacetSummary } from "#/components/common/facet-summary";
import { ListLoading, LoadingState } from "#/components/common/loading-state";
import { SortMenu } from "#/components/common/sort-menu";
import { ErrorNotice } from "#/components/common/states";
import { TagFilter } from "#/components/tags/tag-filter";
import { IndexTaskList } from "#/components/tasks/index-task-list";
import { TypeFilter } from "#/components/tasks/type-filter";
import { MemberFilter } from "#/components/teams/member-filter";
import {
	type FilterSearch,
	filterSearch,
	sortParam,
} from "#/lib/filter-search";
import { PAGE_SIZE } from "#/lib/use-pages";
import { acrossQuery } from "#/queries/across";
import { checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { tagsQuery } from "#/queries/tags";
import {
	type AcrossPageView,
	PRIORITY_LABELS,
	PRIORITY_RANKS,
	type PriorityRank,
} from "#/schemas/task";

/** The corner and the page the screen opens on: the one to do first. */
const FIRST_VIEW: AcrossPageView = {
	groupBy: "priority",
	sort: "newest",
	limit: PAGE_SIZE,
};

export const Route = createFileRoute("/priority")({
	// The order and filters, kept in the address; see `filterSearch`.
	validateSearch: (search: Record<string, unknown>): FilterSearch =>
		filterSearch(search),
	loader: async ({ context }) => {
		// Tags only colour the rows and light their Today buttons, and the
		// checklists give each row its stages and somewhere to move to, the
		// Backlog included; the rows themselves are the screen.
		deferQuery(context.queryClient, tagsQuery());
		deferQuery(context.queryClient, checklistsQuery());

		await primeQuery(context.queryClient, acrossQuery(FIRST_VIEW));
	},
	component: PriorityPage,
});

/**
 * The marks the flags already use, so a band looks like what it holds. Both
 * flags at once is the corner to do first, so it gets a mark of its own rather
 * than borrowing one of the two.
 */
const BAND_ICONS: Record<PriorityRank, typeof CircleAlert> = {
	"urgent-important": Flame,
	urgent: CircleAlert,
	important: Star,
	none: CircleDashed,
};

/** What each band means, so the grid is readable without knowing the theory. */
const BAND_HINTS: Record<PriorityRank, string> = {
	"urgent-important": "Do these first",
	urgent: "Pressing, but ask whether they are worth it",
	important: "The work that actually moves things — protect the time",
	none: "Neither pressing nor important",
};

/**
 * Every task, by priority, wherever it lives.
 *
 * The lists answer "what am I doing today" and "what have I parked". This
 * answers a different question — "what actually matters" — and it deliberately
 * ignores the lists to do it, because a task being urgent has nothing to do
 * with which list somebody filed it under.
 *
 * Each task is the row a tag's page shows — its box, its flags, and the
 * checklist it lives in under the title — so it can be ticked or re-flagged
 * right here. Completed work is left out: this is for deciding what to do next,
 * so a task ticked here leaves the list.
 *
 * The corners, the filters, the order and the page are the server's to answer,
 * as on the Across lists screen: one corner and one page of it come back, with
 * the counts for all four, rather than every task in the space.
 */
function PriorityPage() {
	const navigate = useNavigate();
	const tagsResult = useQuery(tagsQuery());

	// Picked by hand, and kept in the URL; until then newest first, unfiltered.
	const {
		sort = "newest",
		who: assignee,
		tag: tagId,
		type: typeId,
	} = Route.useSearch();
	const [selected, setSelected] = useState<PriorityRank>("urgent-important");
	const [page, setPage] = useState<number | undefined>(undefined);

	/**
	 * Another order or filter. It replaces the address rather than adding to
	 * it, so Back leaves the screen rather than stepping back through every
	 * filter, and the scroll stays.
	 */
	function filterBy(next: FilterSearch) {
		setPage(undefined);
		void navigate({
			to: ".",
			search: (previous) => ({ ...previous, ...next }),
			replace: true,
			resetScroll: false,
		});
	}

	// The rows on screen stay up while another corner, order or page is on
	// its way, as on the Across lists screen.
	const result = useQuery({
		...acrossQuery({
			groupBy: "priority",
			group: selected,
			sort,
			limit: PAGE_SIZE,
			page,
			assignee,
			tag: tagId,
			type: typeId,
		}),
		placeholderData: keepPreviousData,
	});

	const tags = tagsResult.data ?? [];

	if (result.isError) {
		return (
			<VStack gap={4}>
				<Heading level={1}>Priority</Heading>
				<ErrorNotice
					error={result.error}
					onRetry={() => void result.refetch()}
				/>
			</VStack>
		);
	}

	const data = result.data ?? null;
	const countOf = (rank: PriorityRank) =>
		data?.groups.find((group) => group.key === rank)?.count ?? 0;
	const openTotal = PRIORITY_RANKS.reduce(
		(sum, rank) => sum + countOf(rank),
		0,
	);

	/*
	 * The four corners, each with what it holds.
	 *
	 * Completed tasks are already left out, so "left" is the whole count and
	 * "done" is nothing — the summary is a comparison of how much of each kind
	 * is outstanding, which is the question this screen exists to answer.
	 */
	const facets: Array<Facet> = PRIORITY_RANKS.map((rank) => ({
		value: rank,
		label: PRIORITY_LABELS[rank],
		mark: <Icon icon={BAND_ICONS[rank]} size="sm" color="secondary" />,
		total: countOf(rank),
		done: 0,
	}));

	return (
		<VStack gap={4}>
			<VStack gap={0.5}>
				<Heading level={1}>Priority</Heading>
				<Text color="secondary">
					Everything still to do, wherever it lives, by what it is worth.
				</Text>
			</VStack>

			{data === null ? (
				<LoadingState />
			) : openTotal === 0 && !result.isPlaceholderData ? (
				<EmptyState
					title="Nothing to prioritise."
					description="Mark a task urgent or important from any list and it appears here."
				/>
			) : (
				<>
					<FacetSummary
						facets={facets}
						selected={selected}
						onSelect={(value) => {
							setSelected(value as PriorityRank);
							setPage(undefined);
						}}
					/>

					<VStack gap={2}>
						{/* The filters and the order, as every other task list has them. */}
						<HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
							<HStack gap={1} vAlign="center" wrap="wrap">
								<MemberFilter
									value={assignee}
									onChange={(next) => filterBy({ who: next })}
								/>
								<TagFilter
									tags={tags}
									value={tagId}
									onChange={(next) => filterBy({ tag: next })}
								/>
								<TypeFilter
									value={typeId}
									onChange={(next) => filterBy({ type: next })}
								/>
							</HStack>
							<SortMenu
								order={sort}
								hasStageOrder
								onChange={(next) => filterBy({ sort: sortParam(next) })}
							/>
						</HStack>

						<Text type="supporting">{BAND_HINTS[selected]}</Text>

						<ListLoading
							isLoading={result.isPlaceholderData}
							isEmpty={data.items.length === 0}
						>
							{data.items.length === 0 ? (
								<EmptyState
									isCompact
									title="Nothing here."
									description="Nothing is sitting in this corner right now."
								/>
							) : (
								<IndexTaskList
									tasks={data.items}
									page={data.page}
									total={data.total}
									onPageChange={setPage}
								/>
							)}
						</ListLoading>
					</VStack>
				</>
			)}
		</VStack>
	);
}
