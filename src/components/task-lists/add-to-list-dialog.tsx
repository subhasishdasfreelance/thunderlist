import { EmptyState } from "@astryxdesign/core/EmptyState";
import { List, ListItem } from "@astryxdesign/core/List";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { ErrorNotice, RowListSkeleton } from "#/components/common/states";
import { overlayTaggedTasks } from "#/lib/pending/overlay-tags";
import { usePendingChanges } from "#/lib/pending/store";
import { searchIndexQuery } from "#/queries/system";
import type { Task } from "#/schemas/task";
import { TASK_LIST_LABELS, type TaskListName } from "#/schemas/task-list";

const MAX_RESULTS = 25;

/** What `queueAddRef` needs to draw the row before the batch is applied. */
export type PickedTask = {
	checklistId: string;
	checklistTitle: string;
	task: Pick<
		Task,
		"taskId" | "title" | "completed" | "tagIds" | "urgent" | "important"
	>;
};

/**
 * Pick an existing checklist task to put on Today or in the Backlog.
 *
 * Reuses the search index rather than loading every checklist: it already holds
 * each task with the checklist it belongs to and the tags on it.
 */
export function AddToListDialog({
	isOpen,
	onOpenChange,
	list,
	alreadyListed,
	onPick,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	list: TaskListName;
	/** `checklistId:taskId` pairs already on either list, so they can be skipped. */
	alreadyListed: ReadonlySet<string>;
	onPick: (picked: PickedTask) => void;
}) {
	const [query, setQuery] = useState("");
	const queued = usePendingChanges();

	const { data, isPending, isError, error, refetch } = useQuery({
		...searchIndexQuery(),
		enabled: isOpen,
	});

	const candidates = useMemo(() => {
		if (!data) return [];
		const needle = query.trim().toLowerCase();

		return overlayTaggedTasks(data.tasks, queued)
			.filter(
				(task) => !alreadyListed.has(`${task.checklistId}:${task.taskId}`),
			)
			.filter(
				(task) =>
					needle === "" ||
					task.title.toLowerCase().includes(needle) ||
					task.checklistTitle.toLowerCase().includes(needle),
			)
			.slice(0, MAX_RESULTS);
	}, [data, query, alreadyListed, queued]);

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={`Add a task to ${TASK_LIST_LABELS[list]}`}
		>
			<VStack gap={3}>
				<TextInput
					label="Filter tasks"
					isLabelHidden
					placeholder="Filter by task or checklist"
					value={query}
					onChange={setQuery}
				/>

				{isError ? (
					<ErrorNotice error={error} onRetry={() => void refetch()} />
				) : isPending ? (
					<RowListSkeleton count={4} />
				) : candidates.length === 0 ? (
					<EmptyState
						isCompact
						title="Nothing to add"
						description={
							query.trim() === ""
								? "Every task is already on a list, or you have no tasks yet."
								: "No task matched that filter."
						}
					/>
				) : (
					<List hasDividers density="compact">
						{candidates.map((task) => (
							<ListItem
								key={`${task.checklistId}:${task.taskId}`}
								label={task.title}
								description={task.checklistTitle}
								endContent={
									task.completed ? (
										<Text type="supporting" color="secondary">
											Done
										</Text>
									) : undefined
								}
								onClick={() =>
									onPick({
										checklistId: task.checklistId,
										checklistTitle: task.checklistTitle,
										task: {
											taskId: task.taskId,
											title: task.title,
											completed: task.completed,
											tagIds: task.tagIds,
											urgent: task.urgent,
											important: task.important,
										},
									})
								}
							/>
						))}
					</List>
				)}
			</VStack>
		</FormDialog>
	);
}
