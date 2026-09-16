import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChecklistPickerDialog } from "#/components/checklists/checklist-picker-dialog";
import { StageTabs } from "#/components/checklists/stage-tabs";
import { TaskRenameDialog } from "#/components/checklists/task-rename-dialog";
import { TaskRow } from "#/components/checklists/task-row";
import { ListPagination } from "#/components/common/list-pagination";
import { LoadingState } from "#/components/common/loading-state";
import { SortToggle } from "#/components/common/sort-toggle";
import { ErrorNotice } from "#/components/common/states";
import { TaskTypeDialog } from "#/components/tasks/task-type-dialog";
import { AssignDialog } from "#/components/teams/assign-dialog";
import {
	createTagResolver,
	moveToBacklog,
	resolveTags,
	setSpecialTag,
	toggleAssignee,
	updateTask,
	useApplyChange,
} from "#/lib/changes";
import { orderByTask, type SortOrder, shortTitle } from "#/lib/tasks/tasks";
import { usePages } from "#/lib/use-pages";
import { usePermissions, useSpace } from "#/lib/use-team";
import { checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { searchIndexQuery, type TaggedTask } from "#/queries/system";
import { tagsQuery } from "#/queries/tags";
import {
	checklistStages,
	specialChecklist,
	stagesByName,
} from "#/schemas/checklist";

export const Route = createFileRoute("/stages")({
	loader: async ({ context }) => {
		// Tags only colour the rows and light their Today buttons. The tasks, and
		// the checklists whose stages say where each one is, are the screen.
		deferQuery(context.queryClient, tagsQuery());

		await Promise.all([
			primeQuery(context.queryClient, searchIndexQuery()),
			primeQuery(context.queryClient, checklistsQuery()),
		]);
	},
	component: StagesPage,
});

/**
 * Every task, by the stage it is at, whichever checklist it lives in.
 *
 * A checklist's own page shows its stages one at a time. This shows one stage
 * across all of them — everything in review, wherever it is — by name, since
 * the names are what checklists share; see `stagesByName`. Each task is the
 * row a tag's page shows, with the checklist it lives in under the title, so
 * it can be moved on from here, and leaves the list when it is.
 */
function StagesPage() {
	const navigate = useNavigate();
	const { apply, applyAsync } = useApplyChange();
	const index = useQuery(searchIndexQuery());
	const tagsResult = useQuery(tagsQuery());
	const checklistsResult = useQuery(checklistsQuery());

	const [renaming, setRenaming] = useState<TaggedTask | null>(null);
	const [pendingDelete, setPendingDelete] = useState<TaggedTask | null>(null);
	const [assigning, setAssigning] = useState<TaggedTask | null>(null);
	const [typing, setTyping] = useState<TaggedTask | null>(null);
	const [moving, setMoving] = useState<TaggedTask | null>(null);
	// Picked by hand; until then, the first stage.
	const [selected, setSelected] = useState<string | null>(null);
	const [sort, setSort] = useState<SortOrder>("newest");
	const space = useSpace();
	const team = space?.team ?? null;
	const { canManageContent } = usePermissions();

	const tags = tagsResult.data ?? [];
	const checklists = checklistsResult.data ?? [];
	// Somewhere to park a task; see `moveToBacklog`.
	const backlog = specialChecklist(checklists, "backlog");

	const stages = useMemo(
		() => stagesByName(checklistsResult.data ?? [], index.data?.tasks ?? []),
		[checklistsResult.data, index.data],
	);
	const stage = stages.find((each) => each.key === selected) ?? stages[0];
	// Newest first, as every list is, until the order is switched.
	const shown = useMemo(
		() => orderByTask(stage?.tasks ?? [], sort, (task) => task),
		[stage, sort],
	);
	const paging = usePages(shown);

	if (index.isError || checklistsResult.isError) {
		return (
			<VStack gap={4}>
				<Heading level={1}>Stages</Heading>
				<ErrorNotice
					error={index.error ?? checklistsResult.error}
					onRetry={() => {
						void index.refetch();
						void checklistsResult.refetch();
					}}
				/>
			</VStack>
		);
	}

	/** One task, as a tag's page draws it. */
	const taskRow = (task: TaggedTask) => {
		const { checklistId } = task;

		return (
			<TaskRow
				task={task}
				tags={tags}
				stages={checklistStages(
					checklists.find((each) => each.checklistId === checklistId) ?? {},
				)}
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
					onSetStage: (stageId) => updateTask(apply, task.taskId, { stageId }),
					onSetSpecial: (kind, isOn) =>
						setSpecialTag(apply, task, kind, isOn, tags),
					onSetUrgent: (urgent) => updateTask(apply, task.taskId, { urgent }),
					onSetImportant: (important) =>
						updateTask(apply, task.taskId, { important }),
					onSetType: () => setTyping(task),
					onRename: () => setRenaming(task),
					onMove: () => setMoving(task),
					onDelete: () => setPendingDelete(task),
					onAssign: team === null ? undefined : () => setAssigning(task),
					onToggleMine:
						space?.team == null
							? undefined
							: () => toggleAssignee(apply, task, space.email),
				}}
			/>
		);
	};

	return (
		<VStack gap={4}>
			<VStack gap={0.5}>
				<Heading level={1}>Stages</Heading>
				<Text color="secondary">
					Every task by the stage it is at, whichever checklist it is in.
				</Text>
			</VStack>

			{stage === undefined || index.isPending || checklistsResult.isPending ? (
				<LoadingState />
			) : (
				<VStack gap={2}>
					{/* The order, where a checklist's screen has it: above its stages. */}
					<HStack gap={1} hAlign="end" vAlign="center">
						<SortToggle
							order={sort}
							onChange={(next) => {
								setSort(next);
								paging.reset();
							}}
						/>
					</HStack>

					<StageTabs
						stages={stages.map((each) => ({
							stageId: each.key,
							name: each.name,
						}))}
						value={stage.key}
						counts={Object.fromEntries(
							stages.map((each) => [each.key, each.tasks.length]),
						)}
						onChange={(key) => {
							setSelected(key);
							paging.reset();
						}}
					/>

					{shown.length === 0 ? (
						<EmptyState
							isCompact
							title={`Nothing in ${stage.name}.`}
							description={`Tasks at ${stage.name}, in any checklist, show up here.`}
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
								<ListPagination
									page={paging.page}
									total={paging.total}
									onChange={paging.setPage}
								/>
							</VStack>
						</Card>
					)}
				</VStack>
			)}

			<AssignDialog
				isOpen={assigning !== null}
				onOpenChange={(open) => {
					if (!open) setAssigning(null);
				}}
				task={assigning}
				onSubmit={(assignees) => {
					if (assigning) updateTask(apply, assigning.taskId, { assignees });
					setAssigning(null);
				}}
			/>

			<TaskTypeDialog
				isOpen={typing !== null}
				onOpenChange={(open) => {
					if (!open) setTyping(null);
				}}
				task={typing}
				onPick={(typeId) => {
					if (typing) updateTask(apply, typing.taskId, { typeId });
					setTyping(null);
				}}
			/>

			<ChecklistPickerDialog
				isOpen={moving !== null}
				onOpenChange={(open) => {
					if (!open) setMoving(null);
				}}
				title="Move to checklist"
				subtitle={moving?.title}
				checklists={checklists.filter(
					(checklist) => checklist.checklistId !== moving?.checklistId,
				)}
				isLoading={checklistsResult.isPending}
				onPick={(target) => {
					if (moving) {
						apply({
							kind: "task.move",
							taskId: moving.taskId,
							checklistId: target,
						});
					}
					setMoving(null);
				}}
			/>

			<TaskRenameDialog
				isOpen={renaming !== null}
				onOpenChange={(open) => {
					if (!open) setRenaming(null);
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

			<AlertDialog
				isOpen={pendingDelete !== null}
				onOpenChange={(open) => {
					if (!open) setPendingDelete(null);
				}}
				title={`Delete "${shortTitle(pendingDelete?.title ?? "")}"?`}
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
