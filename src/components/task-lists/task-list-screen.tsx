import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ListPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { QuickAddTask } from "#/components/checklists/quick-add-task";
import { CompletedSection } from "#/components/common/completed-section";
import { SortToggle } from "#/components/common/sort-toggle";
import { StatGrid } from "#/components/common/stat-grid";
import { ErrorNotice, RowListSkeleton } from "#/components/common/states";
import { TagFormDialog } from "#/components/tags/tag-form-dialog";
import {
	createTagResolver,
	queueAddRef,
	queueCreateChecklist,
	queueCreateTag,
	queueCreateTask,
	queueMoveRef,
	queueRemoveRef,
	queueUpdateTask,
} from "#/lib/pending/actions";
import { overlayChecklists } from "#/lib/pending/overlay-checklists";
import { overlayTaskLists } from "#/lib/pending/overlay-lists";
import { overlayTags } from "#/lib/pending/overlay-tags";
import { usePendingChanges } from "#/lib/pending/store";
import type { ParsedTitle } from "#/lib/tags/inline-tags";
import { type SortOrder, sortTasksBy } from "#/lib/tasks/tasks";
import { checklistsQuery } from "#/queries/checklists";
import { tagsQuery } from "#/queries/tags";
import { taskListsQuery } from "#/queries/task-lists";
import { INBOX_CHECKLIST_TITLE } from "#/schemas/checklist";
import { todayDateOnly } from "#/schemas/common";
import {
	SORT_ORDER_STEP,
	TASK_LIST_LABELS,
	type TaskListName,
	type TaskRefEntry,
} from "#/schemas/task-list";
import { AddToListDialog, type PickedTask } from "./add-to-list-dialog";
import { DayProgress } from "./day-progress";
import { TaskRefRow } from "./task-ref-row";

/** The next position at the end of a list. */
function endOfList(count: number): number {
	return (count + 1) * SORT_ORDER_STEP;
}

/**
 * Today and Backlog.
 *
 * The two screens are the same screen: the same rows, the same actions, and the
 * same rule that a task is on one list or the other. Only the heading and which
 * list is being shown differ, so they share one component rather than two that
 * drift apart.
 *
 * There are two ways to fill a list, because there are two things people
 * actually do: type something new that has just come up, and pull in a task
 * that already lives in a checklist.
 */
export function TaskListScreen({
	list,
	subtitle,
	emptyTitle,
	emptyDescription,
}: {
	list: TaskListName;
	subtitle: string;
	emptyTitle: string;
	emptyDescription: string;
}) {
	const navigate = useNavigate();
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [isCreatingTag, setIsCreatingTag] = useState(false);
	const [sort, setSort] = useState<SortOrder>("newest");
	const queued = usePendingChanges();

	const { data, isPending, isError, error, refetch } = useQuery(
		taskListsQuery(),
	);
	const tagsResult = useQuery(tagsQuery());
	const checklists = useQuery(checklistsQuery());

	const lists = useMemo(
		() => (data ? overlayTaskLists(data, queued) : { today: [], backlog: [] }),
		[data, queued],
	);

	const tags = useMemo(
		() => overlayTags(tagsResult.data ?? [], queued),
		[tagsResult.data, queued],
	);

	/** The checklist loose tasks go into, if it exists yet. */
	const inbox = useMemo(
		() =>
			overlayChecklists(checklists.data ?? [], queued).find(
				(checklist) => checklist.title === INBOX_CHECKLIST_TITLE,
			) ?? null,
		[checklists.data, queued],
	);

	const entries = lists[list];

	// Done work sits below what is still to do, under its own heading. A stale
	// reference has no task to be done, so it stays with the open items where it
	// can be seen and cleared.
	const completed = entries.filter((entry) => entry.task?.completed);

	// The list order the server gave is the hand-made one; sorting by priority
	// reorders it without losing it, because it falls back to that order inside
	// each band. A reference whose task has gone counts as neither.
	const open = sortTasksBy(
		entries
			.filter((entry) => !entry.task?.completed)
			.map((entry) => ({
				entry,
				urgent: entry.task?.urgent ?? false,
				important: entry.task?.important ?? false,
			})),
		sort,
		() => 0,
	).map((row) => row.entry);

	// A task belongs to at most one list, so both are off limits when adding.
	const alreadyListed = useMemo(
		() =>
			new Set(
				[...lists.today, ...lists.backlog].map(
					(entry) => `${entry.item.checklistId}:${entry.item.taskId}`,
				),
			),
		[lists],
	);

	const done = entries.filter((entry) => entry.task?.completed).length;
	const stats = [
		{ label: "On the list", value: `${entries.length}` },
		{ label: "Done", value: `${done}` },
		{ label: "Left", value: `${entries.length - done}` },
		{
			label: "Complete",
			value:
				entries.length === 0
					? "—"
					: `${Math.round((done / entries.length) * 100)}%`,
		},
		{
			label: list === "today" ? "In the backlog" : "Planned for today",
			value: `${lists[list === "today" ? "backlog" : "today"].length}`,
		},
	];

	/**
	 * Type new tasks straight onto this list, one per line, tags and all.
	 *
	 * The tasks still have to live in a checklist, so the first loose task
	 * creates the Inbox and the rest join it. Every change queues in order, and
	 * the batch replays them in that order, so the checklist exists by the time
	 * the tasks land in it.
	 *
	 * The Inbox is resolved once for the whole paste rather than per line: doing
	 * it per line would queue a second Inbox for the second task, because the
	 * first one is still only a queued change and not yet a checklist to find.
	 */
	function quickAdd(lines: Array<ParsedTitle>) {
		const checklistId =
			inbox?.checklistId ??
			queueCreateChecklist({
				title: INBOX_CHECKLIST_TITLE,
				description: "Tasks added straight to a list.",
				startDate: todayDateOnly(),
				deadline: null,
			});

		// One resolver for the whole paste, so a tag written on three lines is
		// created once: the first two exist only in the queue.
		const resolveTag = createTagResolver(tags);

		lines.forEach((line, offset) => {
			const tagIds = line.tagNames.map(resolveTag);
			const taskId = queueCreateTask({
				checklistId,
				title: line.title,
				tagIds,
			});

			queueAddRef({
				list,
				checklistId,
				checklistTitle: INBOX_CHECKLIST_TITLE,
				task: {
					taskId,
					title: line.title,
					completed: false,
					tagIds,
					urgent: false,
					important: false,
				},
				sortOrder: endOfList(entries.length + offset),
			});
		});
	}

	/** One row, used by both the open and the completed sections. */
	const refRow = (entry: TaskRefEntry) => (
		<TaskRefRow
			entry={entry}
			tags={tags}
			actions={{
				onToggle: (completed) => {
					if (!entry.task) return;
					queueUpdateTask(entry.item.checklistId, entry.task, { completed });
				},
				/**
				 * Moving a reference between the lists, or off both.
				 *
				 * Adding to one takes it off the other, so putting it on the list it
				 * is already on is the way to take it off entirely.
				 */
				onSetList: (next) => {
					if (!entry.task) return;

					if (next === null || next === list) {
						queueRemoveRef({
							list,
							itemId: entry.item.itemId,
							title: entry.task.title,
						});
						return;
					}

					queueAddRef({
						list: next,
						checklistId: entry.item.checklistId,
						checklistTitle: entry.checklistTitle ?? "",
						task: entry.task,
						sortOrder: endOfList(lists[next].length),
					});
				},
				onSetUrgent: (urgent) => {
					if (!entry.task) return;
					queueUpdateTask(entry.item.checklistId, entry.task, { urgent });
				},
				onSetImportant: (important) => {
					if (!entry.task) return;
					queueUpdateTask(entry.item.checklistId, entry.task, { important });
				},
				onRemove: () =>
					queueRemoveRef({
						list,
						itemId: entry.item.itemId,
						title: entry.task?.title ?? "this item",
					}),
				onMove: (direction) =>
					queueMoveRef({
						list,
						itemId: entry.item.itemId,
						title: entry.task?.title ?? "this item",
						direction,
					}),
				onOpenChecklist: () =>
					void navigate({
						to: "/checklists/$checklistId",
						params: { checklistId: entry.item.checklistId },
					}),
			}}
		/>
	);

	function addExisting(picked: PickedTask) {
		queueAddRef({
			list,
			checklistId: picked.checklistId,
			checklistTitle: picked.checklistTitle,
			task: picked.task,
			sortOrder: endOfList(entries.length),
		});
		setIsAddOpen(false);
	}

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<VStack gap={0.5}>
					<Heading level={1}>{TASK_LIST_LABELS[list]}</Heading>
					{/* Formatted in the viewer's locale, so server and client can differ. */}
					<span suppressHydrationWarning>
						<Text color="secondary">{subtitle}</Text>
					</span>
				</VStack>
				<Button
					label="From a checklist"
					variant="secondary"
					icon={<ListPlus aria-hidden />}
					onClick={() => setIsAddOpen(true)}
				/>
			</HStack>

			{isPending || entries.length === 0 ? null : <StatGrid stats={stats} />}

			{/* Today is the one list with a deadline it did not choose: midnight. */}
			{list === "today" ? (
				<DayProgress total={entries.length} completed={done} />
			) : null}

			<QuickAddTask tags={tags} onAdd={quickAdd} />

			{open.length === 0 ? null : (
				<HStack gap={2} hAlign="between" vAlign="center">
					<Text type="label" weight="semibold" color="secondary">
						{open.length} to do
					</Text>
					<SortToggle order={sort} onChange={setSort} />
				</HStack>
			)}

			{isError ? (
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			) : isPending ? (
				<Card padding={4}>
					<RowListSkeleton />
				</Card>
			) : entries.length === 0 ? (
				<EmptyState title={emptyTitle} description={emptyDescription} />
			) : open.length === 0 ? (
				<EmptyState
					title="All done."
					description="Everything on this list is complete."
				/>
			) : (
				<Card padding={0}>
					<VStack gap={0} paddingInline={4} paddingBlock={2}>
						{open.map((entry, index) => (
							<div
								key={entry.item.itemId}
								className="thunderlist-row thunderlist-task-row"
							>
								{index === 0 ? null : <Divider />}
								{refRow(entry)}
							</div>
						))}
					</VStack>
				</Card>
			)}

			<CompletedSection
				count={completed.length}
				clearLabel={`Clear from ${TASK_LIST_LABELS[list]}`}
				onClear={() => {
					for (const entry of completed) {
						queueRemoveRef({
							list,
							itemId: entry.item.itemId,
							title: entry.task?.title ?? "this item",
						});
					}
				}}
			>
				{completed.map((entry, index) => (
					<div
						key={entry.item.itemId}
						className="thunderlist-row thunderlist-task-row"
					>
						{index === 0 ? null : <Divider />}
						{refRow(entry)}
					</div>
				))}
			</CompletedSection>

			<AddToListDialog
				isOpen={isAddOpen}
				onOpenChange={setIsAddOpen}
				list={list}
				alreadyListed={alreadyListed}
				onPick={addExisting}
			/>

			<TagFormDialog
				isOpen={isCreatingTag}
				onOpenChange={setIsCreatingTag}
				existingNames={tags.map((tag) => tag.name)}
				onSubmit={(values) => {
					queueCreateTag(values);
					setIsCreatingTag(false);
				}}
			/>
		</VStack>
	);
}
