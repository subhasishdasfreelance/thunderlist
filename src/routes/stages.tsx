import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChecklistPickerDialog } from "#/components/checklists/checklist-picker-dialog";
import { QuickAddTask } from "#/components/checklists/quick-add-task";
import { StageTabs } from "#/components/checklists/stage-tabs";
import { TaskRenameDialog } from "#/components/checklists/task-rename-dialog";
import { TaskRow } from "#/components/checklists/task-row";
import { ListPagination } from "#/components/common/list-pagination";
import { ListLoading, LoadingState } from "#/components/common/loading-state";
import { SortMenu } from "#/components/common/sort-menu";
import { ErrorNotice } from "#/components/common/states";
import { TagFilter } from "#/components/tags/tag-filter";
import { TagTasks } from "#/components/tags/tag-tasks";
import { GroupByToggle } from "#/components/tasks/group-by-toggle";
import { TaskTypeDialog } from "#/components/tasks/task-type-dialog";
import { TypeFilter } from "#/components/tasks/type-filter";
import { AssignDialog } from "#/components/teams/assign-dialog";
import { MemberFilter } from "#/components/teams/member-filter";
import type { AcrossTask } from "#/data/across.server";
import {
	createTagResolver,
	createTask,
	moveToBacklog,
	resolveChecklistName,
	resolveTags,
	resolveTrackerName,
	setSpecialTag,
	toggleAssignee,
	updateTask,
	useApplyChange,
} from "#/lib/changes";
import type { ParsedTitle } from "#/lib/tags/inline-tags";
import { type SortOrder, shortTitle } from "#/lib/tasks/tasks";
import { PAGE_SIZE } from "#/lib/use-pages";
import { usePermissions, useSpace } from "#/lib/use-team";
import { acrossQuery } from "#/queries/across";
import { checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { tagsQuery } from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import { checklistStages, specialChecklist } from "#/schemas/checklist";
import type { AcrossPageView, GroupBy } from "#/schemas/task";

/** The cut and the page the screen opens on: by stage, newest first. */
const FIRST_VIEW: AcrossPageView = {
	groupBy: "stage",
	sort: "newest",
	limit: PAGE_SIZE,
};

export const Route = createFileRoute("/stages")({
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
	const { apply, applyAsync } = useApplyChange();

	const [renaming, setRenaming] = useState<AcrossTask | null>(null);
	const [pendingDelete, setPendingDelete] = useState<AcrossTask | null>(null);
	const [assigning, setAssigning] = useState<AcrossTask | null>(null);
	const [typing, setTyping] = useState<AcrossTask | null>(null);
	// The tasks a tag is being put on: the one pointed at, or every one
	// picked out; see `TagPickerDialog`.
	const [tagging, setTagging] = useState<ReadonlyArray<AcrossTask> | null>(
		null,
	);
	const [moving, setMoving] = useState<AcrossTask | null>(null);
	const [groupBy, setGroupBy] = useState<GroupBy>("stage");
	// Picked by hand; until then, the first group of whichever cut is shown.
	const [group, setGroup] = useState<string | undefined>(undefined);
	const [page, setPage] = useState<number | undefined>(undefined);
	const [sort, setSort] = useState<SortOrder>("newest");
	const [assignee, setAssignee] = useState<string | undefined>(undefined);
	const [tagId, setTagId] = useState<string | undefined>(undefined);
	const [typeId, setTypeId] = useState<string | undefined>(undefined);
	const space = useSpace();
	const team = space?.team ?? null;
	const { canManageContent } = usePermissions();

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
	// Somewhere to park a task; see `moveToBacklog`.
	const backlog = specialChecklist(checklists, "backlog");

	/** Back to the first page, for a different list shown in its place. */
	const turn =
		<T,>(set: (value: T) => void) =>
		(value: T) => {
			set(value);
			setPage(undefined);
		};

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

	/**
	 * Add a pasted block of tasks. Belonging to no list yet, they go into the
	 * Inbox; see `ensureInbox`. One resolver for the whole block, so a tag
	 * written on three lines is created once rather than three times.
	 */
	function addTasks(lines: Array<ParsedTitle>) {
		const resolveTag = createTagResolver(apply, tags, canManageContent);

		for (const line of lines) {
			// A line naming a tracker or a checklist becomes a task that follows
			// it, titled with its own title. A name matching nothing stays text.
			const tracker = resolveTrackerName(trackers, line.trackerName);
			const linked = tracker
				? null
				: resolveChecklistName(checklists, line.trackerName);

			createTask(apply, {
				checklistId: null,
				title: tracker?.title ?? linked?.title ?? line.title,
				tagIds: tracker || linked ? [] : resolveTags(resolveTag, line.tagNames),
				trackerId: tracker?.trackerId ?? null,
				linkedChecklistId: linked?.checklistId ?? null,
				urgent: line.urgent,
				important: line.important,
			});
		}
	}

	/** One task, as a tag's page draws it. */
	const taskRow = (task: AcrossTask) => {
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
										task.checklistTitle,
										checklists.map((each) => each.title),
									),
							}
				}
				checklist={
					checklistId === null
						? null
						: {
								title: task.checklistTitle,
								isBacklog: checklistId === backlog?.checklistId,
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
					onAddTag: () => setTagging([task]),
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

			{/* Adding a task is shaping the work; see `Capability`. */}
			{canManageContent ? (
				<QuickAddTask
					placeholder="Add a task to the Inbox — #tag it, &track it, or paste a list"
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
								onChange={(next) => {
									setGroupBy(next);
									// The groups are named differently now, so whatever was
									// picked under the old cut no longer means anything.
									setGroup(undefined);
									setPage(undefined);
								}}
							/>
							<MemberFilter value={assignee} onChange={turn(setAssignee)} />
							<TagFilter tags={tags} value={tagId} onChange={turn(setTagId)} />
							{groupBy === "stage" ? (
								<TypeFilter value={typeId} onChange={turn(setTypeId)} />
							) : null}
						</HStack>
						<SortMenu
							order={sort}
							// One stage at a time when that is the cut; by type a group
							// gathers tasks from every stage there is.
							hasStageOrder={groupBy === "type"}
							onChange={turn(setSort)}
						/>
					</HStack>

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
							setGroup(key);
							setPage(undefined);
						}}
					/>

					<ListLoading isLoading={result.isPlaceholderData}>
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
							<Card padding={0}>
								<VStack gap={0} paddingBlock={2}>
									{data.items.map((task, position) => (
										<div
											key={task.taskId}
											className="thunderlist-row thunderlist-task-row"
										>
											{position === 0 ? null : <Divider />}
											{taskRow(task)}
										</div>
									))}
									<ListPagination
										page={data.page}
										total={data.total}
										onChange={setPage}
									/>
								</VStack>
							</Card>
						)}
					</ListLoading>
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

			<TagTasks
				tasks={tagging}
				tags={tags}
				canCreate={canManageContent}
				onClose={() => setTagging(null)}
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
