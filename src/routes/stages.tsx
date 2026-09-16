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
import { SortMenu } from "#/components/common/sort-menu";
import { ErrorNotice } from "#/components/common/states";
import { TagFilter } from "#/components/tags/tag-filter";
import {
	type GroupBy,
	GroupByToggle,
} from "#/components/tasks/group-by-toggle";
import { TaskTypeDialog } from "#/components/tasks/task-type-dialog";
import { TypeFilter } from "#/components/tasks/type-filter";
import { AssignDialog } from "#/components/teams/assign-dialog";
import { MemberFilter } from "#/components/teams/member-filter";
import {
	createTagResolver,
	moveToBacklog,
	resolveTags,
	setSpecialTag,
	toggleAssignee,
	updateTask,
	useApplyChange,
} from "#/lib/changes";
import {
	matchesFilter,
	orderByTask,
	type SortOrder,
	shortTitle,
} from "#/lib/tasks/tasks";
import { usePages } from "#/lib/use-pages";
import { useTaskTypes } from "#/lib/use-task-types";
import { usePermissions, useSpace } from "#/lib/use-team";
import { checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { searchIndexQuery, type TaggedTask } from "#/queries/system";
import { tagsQuery } from "#/queries/tags";
import {
	checklistStages,
	specialChecklist,
	stageProgress,
	stagesByName,
} from "#/schemas/checklist";
import { tasksByType } from "#/schemas/task-type";

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
 * Each task is the row a tag's page shows, with the checklist it lives in
 * under the title, so it can be moved on from here, and leaves the list when
 * it is.
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
	const [groupBy, setGroupBy] = useState<GroupBy>("stage");
	// Picked by hand; until then, the first group of whichever cut is shown.
	const [selected, setSelected] = useState<string | null>(null);
	const [sort, setSort] = useState<SortOrder>("newest");
	const [assignee, setAssignee] = useState<string | undefined>(undefined);
	const [tagId, setTagId] = useState<string | undefined>(undefined);
	const [typeId, setTypeId] = useState<string | undefined>(undefined);
	const space = useSpace();
	const team = space?.team ?? null;
	const { canManageContent } = usePermissions();
	const types = useTaskTypes();

	const tags = tagsResult.data ?? [];
	const checklists = checklistsResult.data ?? [];
	// Somewhere to park a task; see `moveToBacklog`.
	const backlog = specialChecklist(checklists, "backlog");

	// Cut by type, the tabs are already the type filter, so only the other two
	// narrow the rows then.
	const shownType = groupBy === "stage" ? typeId : undefined;
	const narrowed = useMemo(
		() =>
			(index.data?.tasks ?? []).filter((task) =>
				matchesFilter(task, { assignee, tag: tagId, type: shownType }),
			),
		[index.data, assignee, tagId, shownType],
	);

	const groups = useMemo(
		() =>
			groupBy === "stage"
				? stagesByName(checklistsResult.data ?? [], narrowed)
				: tasksByType(types, narrowed),
		[groupBy, checklistsResult.data, narrowed, types],
	);
	const group = groups.find((each) => each.key === selected) ?? groups[0];
	// Newest first, as every list is, until the order is switched.
	const shown = useMemo(
		() =>
			orderByTask(
				group?.tasks ?? [],
				sort,
				(task) => task,
				// Only meaningful cut by type, where one group holds tasks at every
				// stage of every list; see `stageProgress`.
				(task) =>
					stageProgress(
						task,
						checklistStages(
							checklists.find(
								(each) => each.checklistId === task.checklistId,
							) ?? {},
						),
					),
				types,
			),
		[group, sort, types, checklists],
	);
	const paging = usePages(shown);

	if (index.isError || checklistsResult.isError) {
		return (
			<VStack gap={4}>
				<Heading level={1}>Across lists</Heading>
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
				<Heading level={1}>Across lists</Heading>
				<Text color="secondary">
					Every task by the stage it is at, or by what kind of work it is,
					whichever checklist it is in.
				</Text>
			</VStack>

			{group === undefined || index.isPending || checklistsResult.isPending ? (
				<LoadingState />
			) : (
				<VStack gap={2}>
					{/* The cut and the filters, then the order — as a checklist has it. */}
					<HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
						<HStack gap={1} vAlign="center" wrap="wrap">
							<GroupByToggle
								value={groupBy}
								onChange={(next) => {
									setGroupBy(next);
									// The groups are named differently now, so whatever was
									// picked under the old cut no longer means anything.
									setSelected(null);
									paging.reset();
								}}
							/>
							<MemberFilter
								value={assignee}
								onChange={(next) => {
									setAssignee(next);
									paging.reset();
								}}
							/>
							<TagFilter
								tags={tags}
								value={tagId}
								onChange={(next) => {
									setTagId(next);
									paging.reset();
								}}
							/>
							{groupBy === "stage" ? (
								<TypeFilter
									value={typeId}
									onChange={(next) => {
										setTypeId(next);
										paging.reset();
									}}
								/>
							) : null}
						</HStack>
						<SortMenu
							order={sort}
							// One stage at a time when that is the cut; by type a group
							// gathers tasks from every stage there is.
							hasStageOrder={groupBy === "type"}
							onChange={(next) => {
								setSort(next);
								paging.reset();
							}}
						/>
					</HStack>

					<StageTabs
						stages={groups.map((each) => ({
							stageId: each.key,
							name: each.name,
						}))}
						value={group.key}
						counts={Object.fromEntries(
							groups.map((each) => [each.key, each.tasks.length]),
						)}
						onChange={(key) => {
							setSelected(key);
							paging.reset();
						}}
					/>

					{shown.length === 0 ? (
						<EmptyState
							isCompact
							title={`Nothing in ${group.name}.`}
							description={
								groupBy === "stage"
									? `Tasks at ${group.name}, in any checklist, show up here.`
									: "Tasks of this kind, in any checklist, show up here."
							}
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
