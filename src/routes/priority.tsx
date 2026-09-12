import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleAlert, CircleDashed, Flame, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { TaskRenameDialog } from "#/components/checklists/task-rename-dialog";
import { TaskRow } from "#/components/checklists/task-row";
import { type Facet, FacetSummary } from "#/components/common/facet-summary";
import { LoadingState } from "#/components/common/loading-state";
import { ShowMore } from "#/components/common/show-more";
import { ErrorNotice } from "#/components/common/states";
import {
	createTagResolver,
	setSpecialTag,
	updateTask,
	useApplyChange,
} from "#/lib/changes";
import { useShowMore } from "#/lib/use-show-more";
import { deferQuery, primeQuery } from "#/queries/prime";
import { searchIndexQuery, type TaggedTask } from "#/queries/system";
import { tagsQuery } from "#/queries/tags";
import {
	PRIORITY_LABELS,
	PRIORITY_RANKS,
	type PriorityRank,
	priorityRank,
} from "#/schemas/task";

export const Route = createFileRoute("/priority")({
	loader: ({ context }) => {
		// Tags only colour the rows and light their Today and Backlog buttons;
		// the rows themselves are the screen.
		deferQuery(context.queryClient, tagsQuery());

		return primeQuery(context.queryClient, searchIndexQuery());
	},
	component: PriorityPage,
});

/** What each band means, so the grid is readable without knowing the theory. */
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
 */
function PriorityPage() {
	const navigate = useNavigate();
	const { apply } = useApplyChange();
	const index = useQuery(searchIndexQuery());
	const tagsResult = useQuery(tagsQuery());

	const [renaming, setRenaming] = useState<TaggedTask | null>(null);
	const [pendingDelete, setPendingDelete] = useState<TaggedTask | null>(null);

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

	/** One task, as a tag's page draws it. */
	const taskRow = (task: TaggedTask) => {
		const { checklistId } = task;

		return (
			<TaskRow
				task={task}
				tags={tags}
				checklist={
					checklistId === null
						? null
						: {
								title: task.checklistTitle,
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
					onToggle: (completed) =>
						updateTask(apply, task.taskId, { completed }),
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
	};

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
										<div
											key={task.taskId}
											className="thunderlist-row thunderlist-task-row"
										>
											{position === 0 ? null : <Divider />}
											{taskRow(task)}
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
		</VStack>
	);
}
