import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { LoadingState } from "#/components/common/loading-state";
import { StatGrid } from "#/components/common/stat-grid";
import { ErrorNotice } from "#/components/common/states";
import { TaggedTitle } from "#/components/tags/tagged-title";
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

	const bands = useMemo(() => {
		const grouped = new Map<PriorityRank, typeof tasks>();
		for (const rank of PRIORITY_RANKS) grouped.set(rank, []);
		for (const task of tasks) grouped.get(priorityRank(task))?.push(task);
		return grouped;
	}, [tasks]);

	if (index.isError) {
		return (
			<VStack gap={4}>
				<Heading level={1}>Priority</Heading>
				<ErrorNotice error={index.error} onRetry={() => void index.refetch()} />
			</VStack>
		);
	}

	const stats = PRIORITY_RANKS.map((rank) => ({
		label: PRIORITY_LABELS[rank],
		value: `${bands.get(rank)?.length ?? 0}`,
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
					<StatGrid stats={stats} />

					{PRIORITY_RANKS.map((rank) => {
						const band = bands.get(rank) ?? [];
						if (band.length === 0) return null;

						return (
							<VStack key={rank} gap={2}>
								<div className="thunderlist-band" data-rank={rank}>
									<VStack gap={0}>
										<Text type="label" weight="semibold">
											{PRIORITY_LABELS[rank]} · {band.length}
										</Text>
										<Text type="supporting">{BAND_HINTS[rank]}</Text>
									</VStack>
								</div>

								<Card padding={0}>
									<VStack gap={0} paddingInline={4} paddingBlock={2}>
										{band.map((task, position) => (
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
															<Text type="supporting">
																{task.checklistTitle}
															</Text>
														</HStack>
													</button>
												)}
											</div>
										))}
									</VStack>
								</Card>
							</VStack>
						);
					})}
				</>
			)}
		</VStack>
	);
}
