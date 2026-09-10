import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleDashed, Star, Zap, ZapOff } from "lucide-react";
import { useMemo, useState } from "react";
import { type Facet, FacetSummary } from "#/components/common/facet-summary";
import { LoadingState } from "#/components/common/loading-state";
import { ShowMore } from "#/components/common/show-more";
import { ErrorNotice } from "#/components/common/states";
import { TaggedTitle } from "#/components/tags/tagged-title";
import { useShowMore } from "#/lib/use-show-more";
import { deferQuery, primeQuery } from "#/queries/prime";
import { searchIndexQuery } from "#/queries/system";
import { tagsQuery } from "#/queries/tags";
import {
	PRIORITY_LABELS,
	PRIORITY_RANKS,
	type PriorityRank,
	priorityRank,
} from "#/schemas/task";

export const Route = createFileRoute("/priority")({
	loader: ({ context }) => {
		// Tags only colour the rows; the rows themselves are the screen.
		deferQuery(context.queryClient, tagsQuery());

		return primeQuery(context.queryClient, searchIndexQuery());
	},
	component: PriorityPage,
});

/** What each band means, so the grid is readable without knowing the theory. */
/** The marks the flags already use, so a band looks like what it holds. */
const BAND_ICONS: Record<PriorityRank, typeof Zap> = {
	"urgent-important": Zap,
	urgent: ZapOff,
	important: Star,
	none: CircleDashed,
};

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
 * Completed work is left out: this is for deciding what to do next.
 */
function PriorityPage() {
	const navigate = useNavigate();

	const index = useQuery(searchIndexQuery());
	const tagsResult = useQuery(tagsQuery());

	const tags = tagsResult.data ?? [];

	const tasks = useMemo(
		() => (index.data?.tasks ?? []).filter((task) => !task.completed),
		[index.data],
	);

	const [selected, setSelected] = useState<PriorityRank>("urgent-important");

	const bands = useMemo(() => {
		const grouped = new Map<PriorityRank, typeof tasks>();
		for (const rank of PRIORITY_RANKS) grouped.set(rank, []);
		for (const task of tasks) grouped.get(priorityRank(task))?.push(task);
		return grouped;
	}, [tasks]);

	const shown = bands.get(selected) ?? [];
	const paging = useShowMore(shown);

	if (index.isError) {
		return (
			<VStack gap={4}>
				<Heading level={1}>Priority</Heading>
				<ErrorNotice error={index.error} onRetry={() => void index.refetch()} />
			</VStack>
		);
	}

	/*
	 * The four corners, each with what it holds.
	 *
	 * Completed tasks are already filtered out, so "left" is the whole count and
	 * "done" is nothing — the summary is a comparison of how much of each kind
	 * is outstanding, which is the question this screen exists to answer.
	 */
	const facets: Array<Facet> = PRIORITY_RANKS.map((rank) => ({
		value: rank,
		label: PRIORITY_LABELS[rank],
		mark: <Icon icon={BAND_ICONS[rank]} size="sm" color="secondary" />,
		total: bands.get(rank)?.length ?? 0,
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

			{index.isPending && tasks.length === 0 ? (
				<LoadingState />
			) : tasks.length === 0 ? (
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
							paging.reset();
						}}
					/>

					<VStack gap={2}>
						<Text type="supporting">{BAND_HINTS[selected]}</Text>

						{shown.length === 0 ? (
							<EmptyState
								isCompact
								title="Nothing here."
								description="Nothing is sitting in this corner right now."
							/>
						) : (
							<Card padding={0}>
								<VStack gap={0} paddingBlock={2}>
									{paging.shown.map((task, position) => (
										<div key={task.taskId} className="thunderlist-row">
											{position === 0 ? null : <Divider />}
											{/* A task in no checklist has nowhere to open, so it
											    is a row rather than a link. */}
											{task.checklistId === null ? (
												<HStack
													gap={2}
													hAlign="between"
													vAlign="center"
													paddingBlock={1.5}
												>
													<TaggedTitle title={task.title} tags={tags} />
												</HStack>
											) : (
												<button
													type="button"
													className="thunderlist-task-row w-full cursor-pointer text-left"
													onClick={() =>
														void navigate({
															to: "/checklists/$checklistId",
															params: {
																checklistId: task.checklistId as string,
															},
															search: { task: task.taskId },
														})
													}
												>
													<HStack
														gap={2}
														hAlign="between"
														vAlign="center"
														paddingBlock={1.5}
													>
														<TaggedTitle title={task.title} tags={tags} />
														<Text type="supporting">{task.checklistTitle}</Text>
													</HStack>
												</button>
											)}
										</div>
									))}
									<ShowMore
										hidden={paging.hidden}
										onShowMore={paging.showMore}
									/>
								</VStack>
							</Card>
						)}
					</VStack>
				</>
			)}
		</VStack>
	);
}
