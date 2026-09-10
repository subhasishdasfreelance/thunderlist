import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Eraser, ListPlus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { QuickAddTask } from "#/components/checklists/quick-add-task";
import { TaskRenameDialog } from "#/components/checklists/task-rename-dialog";
import { CompletedSection } from "#/components/common/completed-section";
import { LoadingState } from "#/components/common/loading-state";
import { ProgressChart } from "#/components/common/progress-chart";
import { SortToggle } from "#/components/common/sort-toggle";
import { StatGrid } from "#/components/common/stat-grid";
import { ErrorNotice } from "#/components/common/states";
import { TagFormDialog } from "#/components/tags/tag-form-dialog";
import {
	addTaskRef,
	createTag,
	createTagResolver,
	createTask,
	resolveTrackerName,
	updateTask,
	useApplyChange,
} from "#/lib/changes";
import { completionPoints, DAY_MS, startOfDay } from "#/lib/chart-points";
import type { ParsedTitle } from "#/lib/tags/inline-tags";
import { type SortOrder, sortTasksBy } from "#/lib/tasks/tasks";
import { useFocusTask } from "#/lib/use-focus-task";
import { useReorderAnimation } from "#/lib/use-reorder-animation";
import { tagsQuery } from "#/queries/tags";
import { taskListsQuery } from "#/queries/task-lists";
import { trackersQuery } from "#/queries/trackers";
import type { Task } from "#/schemas/task";
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
/**
 * What clearing a list is about to do, in one sentence per outcome.
 *
 * Two different things happen and only one of them is destructive, so both are
 * named before the user commits. A count of zero is left out entirely: "0 tasks
 * are deleted" is a sentence the reader has to parse to learn nothing.
 */
function clearWarning(withChecklist: number, loose: number): string {
	const lines: Array<string> = [];

	if (withChecklist > 0) {
		lines.push(
			withChecklist === 1
				? "1 task stays in its checklist and is only taken off the list."
				: `${withChecklist} tasks stay in their checklists and are only taken off the list.`,
		);
	}

	if (loose > 0) {
		lines.push(
			loose === 1
				? "1 task belongs to no checklist and is deleted."
				: `${loose} tasks belong to no checklist and are deleted.`,
		);
	}

	return lines.join(" ");
}

export function TaskListScreen({
	list,
	subtitle,
	emptyTitle,
	emptyDescription,
	focusTaskId,
}: {
	list: TaskListName;
	subtitle: string;
	emptyTitle: string;
	emptyDescription: string;
	/** `?task=`: a task to scroll to and ring, arrived at from search. */
	focusTaskId?: string;
}) {
	const navigate = useNavigate();
	const listRef = useRef<HTMLDivElement>(null);
	useFocusTask(focusTaskId);
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [isCreatingTag, setIsCreatingTag] = useState(false);
	const [sort, setSort] = useState<SortOrder>("newest");
	const [editing, setEditing] = useState<Task | null>(null);
	const [isClearingAll, setIsClearingAll] = useState(false);
	const { apply } = useApplyChange();

	const { data, isPending, isError, error, refetch } = useQuery(
		taskListsQuery(),
	);
	const tagsResult = useQuery(tagsQuery());
	const trackersResult = useQuery(trackersQuery());

	const lists = data ?? { today: [], backlog: [] };

	const tags = tagsResult.data ?? [];
	const trackers = trackersResult.data ?? [];

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

	// Moving a row is the one change where where it went is the point, so the
	// rows slide rather than re-painting in their new order.
	useReorderAnimation(listRef, open.map((entry) => entry.item.taskId).join());

	/*
	 * Today's burn-up, against the clock rather than a calendar.
	 *
	 * Only Today has a finish line: the backlog is a place things wait, so there
	 * is no plan for it to be measured against and nothing honest to plot.
	 */
	const dayStartsAt = startOfDay();
	const dayChart =
		list === "today" && entries.length > 0 ? (
			<ProgressChart
				start={dayStartsAt}
				end={dayStartsAt + DAY_MS}
				now={Date.now()}
				target={entries.length}
				current={completed.length}
				points={completionPoints(
					entries.flatMap((entry) => (entry.task ? [entry.task] : [])),
					dayStartsAt,
				)}
				startLabel="12:00 AM"
				endLabel="Midnight"
				summary={`${completed.length} of ${entries.length} tasks done today`}
			/>
		) : undefined;

	// A task belongs to at most one list, so both are off limits when adding.
	const alreadyListed = useMemo(
		() =>
			new Set(
				[...lists.today, ...lists.backlog].map((entry) => entry.item.taskId),
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
	 * A task written here belongs to no checklist. It is a thing to do, not part
	 * of a body of work, and inventing a checklist to hold it would only put a
	 * checklist nobody asked for on the Checklists screen.
	 *
	 * One tag resolver for the whole paste, so a tag written on three lines is
	 * created once rather than three times.
	 */
	function quickAdd(lines: Array<ParsedTitle>) {
		const resolveTag = createTagResolver(apply, tags);

		// One change per line: creating the task and putting it on this list is a
		// single act, and splitting it in two used to let the second half arrive
		// before the first and be refused.
		lines.forEach((line, offset) => {
			// A line naming a tracker becomes a task that follows it, titled with
			// the tracker's own title — the `&` was how it was written, not what it
			// is called. A name matching nothing stays ordinary text.
			const tracker = resolveTrackerName(trackers, line.trackerName);

			createTask(apply, {
				checklistId: null,
				title: tracker?.title ?? line.title,
				tagIds: tracker ? [] : line.tagNames.map(resolveTag),
				trackerId: tracker?.trackerId ?? null,
				onList: { list, sortOrder: endOfList(entries.length + offset) },
			});
		});
	}

	/** One row, used by both the open and the completed sections. */
	const refRow = (entry: TaskRefEntry) => (
		<TaskRefRow
			entry={entry}
			tags={tags}
			actions={{
				onToggle: (completed) =>
					updateTask(apply, entry.item.taskId, { completed }),
				/**
				 * Moving a reference between the lists, or off both.
				 *
				 * Adding to one takes it off the other, so putting it on the list it
				 * is already on is the way to take it off entirely.
				 */
				onSetList: (next) => {
					if (next === null || next === list) {
						apply({ kind: "ref.remove", list, itemId: entry.item.itemId });
						return;
					}

					addTaskRef(apply, {
						list: next,
						taskId: entry.item.taskId,
						sortOrder: endOfList(lists[next].length),
					});
				},
				onSetUrgent: (urgent) =>
					updateTask(apply, entry.item.taskId, { urgent }),
				onSetImportant: (important) =>
					updateTask(apply, entry.item.taskId, { important }),
				onRemove: () =>
					apply({ kind: "ref.remove", list, itemId: entry.item.itemId }),
				onMove: (direction) =>
					apply({
						kind: "ref.move",
						list,
						itemId: entry.item.itemId,
						direction,
					}),
				onEdit: () => {
					if (entry.task) setEditing(entry.task);
				},
				// Straight to the task, not just the checklist it lives in.
				onOpenChecklist: entry.checklistId
					? () => {
							void navigate({
								to: "/checklists/$checklistId",
								params: { checklistId: entry.checklistId as string },
								search: { task: entry.item.taskId },
							});
						}
					: null,
			}}
			canReorder={sort === "newest"}
		/>
	);

	const withChecklist = entries.filter(
		(entry) => entry.checklistId !== null,
	).length;
	const loose = entries.length - withChecklist;

	/**
	 * Empty the list.
	 *
	 * What that means depends on where the task came from. One that lives in a
	 * checklist is only taken off this list — the checklist is its home and this
	 * was a plan for the day. One that belongs to no checklist has no home to go
	 * back to, so clearing it is deleting it; there would be nowhere left to find
	 * it and it would simply become unreachable.
	 */
	function clearAll() {
		for (const entry of entries) {
			if (entry.checklistId === null) {
				apply({ kind: "task.delete", taskId: entry.item.taskId });
			} else {
				apply({ kind: "ref.remove", list, itemId: entry.item.itemId });
			}
		}
	}

	function addExisting(picked: PickedTask) {
		addTaskRef(apply, {
			list,
			taskId: picked.taskId,
			sortOrder: endOfList(entries.length),
		});
		setIsAddOpen(false);
	}

	return (
		<VStack gap={4}>
			{/*
			 * The actions sit beside the heading on a desktop and drop below it on
			 * a phone. Kept on one line they squeeze the date into a column of
			 * three short lines, which is a worse trade than a second row.
			 */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<VStack gap={0.5}>
					<Heading level={1}>{TASK_LIST_LABELS[list]}</Heading>
					{/* Formatted in the viewer's locale, so server and client can differ. */}
					<span suppressHydrationWarning>
						<Text color="secondary">{subtitle}</Text>
					</span>
				</VStack>
				<HStack gap={1} vAlign="center">
					{entries.length === 0 ? null : (
						<Button
							label={`Clear ${TASK_LIST_LABELS[list]}`}
							variant="ghost"
							icon={<Eraser aria-hidden />}
							onClick={() => setIsClearingAll(true)}
						/>
					)}
					<Button
						label="From a checklist"
						variant="secondary"
						icon={<ListPlus aria-hidden />}
						onClick={() => setIsAddOpen(true)}
					/>
				</HStack>
			</div>

			{isPending || entries.length === 0 ? null : <StatGrid stats={stats} />}

			{/* Today is the one list with a deadline it did not choose: midnight. */}
			{list === "today" ? (
				<DayProgress total={entries.length} completed={done} />
			) : null}

			<QuickAddTask tags={tags} trackers={trackers} onAdd={quickAdd} />

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
				<LoadingState />
			) : entries.length === 0 ? (
				<EmptyState title={emptyTitle} description={emptyDescription} />
			) : open.length === 0 ? (
				<EmptyState
					title="All done."
					description="Everything on this list is complete."
				/>
			) : (
				// The ref is what `useReorderAnimation` measures the rows through.
				<div ref={listRef}>
					<Card padding={0}>
						<VStack gap={0} paddingBlock={2}>
							{open.map((entry, index) => (
								<div
									key={entry.item.itemId}
									className="thunderlist-row thunderlist-task-row"
									data-task-id={entry.item.taskId}
									data-focused={entry.item.taskId === focusTaskId}
								>
									{index === 0 ? null : <Divider />}
									{refRow(entry)}
								</div>
							))}
						</VStack>
					</Card>
				</div>
			)}

			<CompletedSection
				count={completed.length}
				clearLabel={`Clear from ${TASK_LIST_LABELS[list]}`}
				onClear={() => {
					for (const entry of completed) {
						apply({ kind: "ref.remove", list, itemId: entry.item.itemId });
					}
				}}
				chart={dayChart}
			>
				{completed.map((entry, index) => (
					<div
						key={entry.item.itemId}
						className="thunderlist-row thunderlist-task-row"
						data-task-id={entry.item.taskId}
						data-focused={entry.item.taskId === focusTaskId}
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

			<AlertDialog
				isOpen={isClearingAll}
				onOpenChange={setIsClearingAll}
				title={`Clear ${TASK_LIST_LABELS[list]}?`}
				description={clearWarning(withChecklist, loose)}
				actionLabel="Clear"
				onAction={() => {
					clearAll();
					setIsClearingAll(false);
				}}
			/>

			<TaskRenameDialog
				isOpen={editing !== null}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
				task={editing}
				tags={tags}
				onSubmit={(parsed) => {
					if (editing) {
						const resolveTag = createTagResolver(apply, tags);
						updateTask(apply, editing.taskId, {
							title: parsed.title,
							tagIds: parsed.tagNames.map(resolveTag),
						});
					}
					setEditing(null);
				}}
			/>

			<TagFormDialog
				isOpen={isCreatingTag}
				onOpenChange={setIsCreatingTag}
				existingNames={tags.map((tag) => tag.name)}
				onSubmit={(values) => {
					createTag(apply, values);
					setIsCreatingTag(false);
				}}
			/>
		</VStack>
	);
}
