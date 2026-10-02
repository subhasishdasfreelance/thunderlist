import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ClipboardPaste,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { ChecklistCard } from "#/components/checklists/checklist-card";
import { ArrangeDialog } from "#/components/common/arrange-dialog";
import {
	ArrangeButton,
	ArrangedCards,
	ListOrderMenu,
	SelectButton,
	useListOrder,
} from "#/components/common/arranged-list";
import { BackButton } from "#/components/common/back-button";
import { numberTitle } from "#/components/common/item-number";
import {
	ITEM_KIND_ICONS,
	ItemPickerDialog,
} from "#/components/common/item-picker-dialog";
import { LoadingState } from "#/components/common/loading-state";
import { PaceLabel } from "#/components/common/pace-label";
import { ProgressChart } from "#/components/common/progress-chart";
import {
	formatExpectedTasks,
	ProgressMeter,
} from "#/components/common/progress-meter";
import { ErrorNotice } from "#/components/common/states";
import { VelocityStats } from "#/components/common/velocity-stats";
import { GroupBadge } from "#/components/groups/group-card";
import {
	describeContents,
	useGroupContents,
} from "#/components/groups/group-contents";
import { GroupFormDialog } from "#/components/groups/group-form-dialog";
import { GroupImportDialog } from "#/components/groups/group-import-dialog";
import { arrangeRows, orderContents } from "#/components/groups/group-order";
import { GroupPickedBar } from "#/components/groups/group-picked-bar";
import { TagCard } from "#/components/tags/tag-card";
import { TrackerCard } from "#/components/trackers/tracker-card";
import {
	createTagResolver,
	importIntoGroup,
	useApplyChange,
} from "#/lib/changes";
import { completionPoints, dayStart } from "#/lib/chart-points";
import { formatDate, formatDeadline, formatSchedule } from "#/lib/format-date";
import type { OutlineChecklist } from "#/lib/outline";
import { computeVelocity, localMoment } from "#/lib/progress";
import { useNow } from "#/lib/use-now";
import { paceAt } from "#/lib/use-pace";
import { usePickMode } from "#/lib/use-pick-mode";
import { usePermissions } from "#/lib/use-team";
import { checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { groupFinishedQuery, groupsQuery } from "#/queries/space";
import { tagSummariesQuery, tagsQuery } from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import type { ItemKind } from "#/schemas/common";
import {
	GROUP_ITEM_KINDS,
	type Group,
	type GroupItem,
	groupStartDate,
	sameItem,
} from "#/schemas/group";

export const Route = createFileRoute("/groups/$groupId")({
	loader: ({ context, params }) => {
		deferQuery(context.queryClient, groupFinishedQuery(params.groupId));
		deferQuery(context.queryClient, checklistsQuery());
		deferQuery(context.queryClient, trackersQuery());
		deferQuery(context.queryClient, tagSummariesQuery());
		deferQuery(context.queryClient, tagsQuery());
		return primeQuery(context.queryClient, groupsQuery());
	},
	component: GroupPage,
});

/** One kind of thing in the group, under a heading of its own. */
function Section({
	kind,
	title,
	count,
	children,
}: {
	kind: ItemKind;
	title: string;
	count: number;
	children: ReactNode;
}) {
	if (count === 0) return null;

	return (
		<VStack gap={2}>
			<HStack gap={1.5} vAlign="center">
				<Icon icon={ITEM_KIND_ICONS[kind]} size="sm" color="secondary" />
				<Text type="label" weight="semibold" color="secondary">
					{title}
				</Text>
				<Text type="supporting">{count}</Text>
			</HStack>
			<VStack gap={3}>{children}</VStack>
		</VStack>
	);
}

/**
 * One group: everything in it, as the cards they are on their own screens,
 * and how far along all of it is together — every task in it counted, paced
 * against its deadline and charted the way a checklist is. Adding to it opens
 * the picker; renaming it, its schedule and taking things out are in its
 * dialog.
 */
function GroupPage() {
	const { groupId } = Route.useParams();
	const navigate = useNavigate();
	const { apply } = useApplyChange();
	const { canManageContent } = usePermissions();
	const [isEditing, setIsEditing] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isAdding, setIsAdding] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const queryClient = useQueryClient();

	const { data, isError, error, refetch } = useQuery(groupsQuery());
	const tags = useQuery(tagsQuery()).data ?? [];
	const { contentsOf, isPending } = useGroupContents();
	const finished = useQuery(groupFinishedQuery(groupId)).data;
	const now = useNow();
	const group = data?.find((each) => each.groupId === groupId);
	// Your order, newest added, most behind or priority first; see
	// `orderContents`.
	const [order, setOrder] = useListOrder(`group:${groupId}`);
	const [isArranging, setIsArranging] = useState(false);
	// Several picked out, to change together; see `usePickMode`.
	const pick = usePickMode();

	if (group === undefined) {
		return (
			<VStack gap={4}>
				<BackButton to="/groups" label="Groups" />
				{isError ? (
					<ErrorNotice error={error} onRetry={() => void refetch()} />
				) : data === undefined ? (
					<LoadingState />
				) : (
					<EmptyState
						title="This group is gone."
						description="It may have been deleted."
					/>
				)}
			</VStack>
		);
	}

	const contents = contentsOf(group);
	const shown = orderContents(group, contents, order, now);
	const { total, completed } = contents;
	const startDate = groupStartDate(group);
	const schedule = {
		startDate,
		deadline: group.deadline ?? null,
		deadlineTime: group.deadlineTime ?? null,
	};
	const pace = paceAt(schedule, total === 0 ? null : completed / total, now);
	const velocity =
		now === null
			? null
			: computeVelocity({
					...schedule,
					current: completed,
					target: total,
					now,
				});

	/**
	 * A checklist for each heading, put in this group, in one change. The tags
	 * its lines write are read first, so a tag that exists is not made again.
	 */
	async function importOutline(checklists: Array<OutlineChecklist>) {
		setIsImporting(false);
		const allTags = await queryClient.ensureQueryData(tagsQuery());
		importIntoGroup(
			apply,
			groupId,
			checklists,
			createTagResolver(apply, allTags, canManageContent),
		);
	}

	/** In or out of the group, drawn at once like every change. */
	function toggle(current: Group, item: GroupItem) {
		apply({
			kind: "group.update",
			groupId: current.groupId,
			patch: {
				items: current.items.some((each) => sameItem(each, item))
					? current.items.filter((each) => !sameItem(each, item))
					: [...current.items, item],
			},
		});
	}

	return (
		<VStack gap={4}>
			<BackButton to="/groups" label="Groups" />

			{/* Wraps: the title and three buttons are wider than a phone. */}
			<HStack gap={2} hAlign="between" vAlign="start" wrap="wrap">
				<HStack gap={3} vAlign="center">
					<GroupBadge group={group} size="lg" />
					<VStack gap={0.5}>
						<Heading level={1}>{group.name}</Heading>
						<Text type="supporting">{describeContents(contents)}</Text>
					</VStack>
				</HStack>

				{canManageContent ? (
					<HStack gap={1} vAlign="center">
						<Button
							label="Import"
							icon={<ClipboardPaste aria-hidden />}
							variant="secondary"
							onClick={() => setIsImporting(true)}
						/>
						<Button
							label="Add"
							icon={<Plus aria-hidden />}
							variant="secondary"
							onClick={() => setIsAdding(true)}
						/>
						<DropdownMenu
							hasChevron={false}
							placement="below"
							alignment="end"
							button={{
								label: "Group actions",
								tooltip: "Group actions",
								variant: "ghost",
								isIconOnly: true,
								icon: <MoreHorizontal aria-hidden />,
							}}
							items={[
								// Headed by its number; see `numberTitle`.
								{
									type: "section" as const,
									title: numberTitle("group", group.number),
									items: [
										{
											label: "Edit group",
											icon: Pencil,
											onClick: () => setIsEditing(true),
										},
									],
								},
								{ type: "divider" as const },
								{
									label: "Delete group",
									icon: Trash2,
									variant: "destructive" as const,
									onClick: () => setIsDeleting(true),
								},
							]}
						/>
					</HStack>
				) : null}
			</HStack>

			{contents.percent === null ? null : (
				<>
					<Card padding={3}>
						<VStack gap={2}>
							<HStack gap={2} hAlign="between" vAlign="center">
								<Text weight="medium">{contents.percent}% complete</Text>
								<PaceLabel status={pace.status} />
							</HStack>
							<ProgressMeter
								label={`${group.name} progress`}
								percent={contents.percent}
								elapsed={pace.elapsed}
								expectedReading={
									pace.elapsed == null
										? undefined
										: formatExpectedTasks(pace.elapsed, total)
								}
								footnote={formatSchedule(schedule)}
							/>
						</VStack>
					</Card>

					<VelocityStats
						startDate={startDate}
						velocity={velocity}
						unit="tasks"
						isComplete={total > 0 && completed >= total}
					/>

					{/* Drawn against the viewer's clock, so only once the browser has it. */}
					{now === null || finished === undefined ? null : (
						<Card padding={3}>
							<ProgressChart
								start={dayStart(startDate)}
								end={localMoment(schedule.deadline, schedule.deadlineTime)}
								now={now}
								target={total}
								current={completed}
								points={completionPoints(finished, dayStart(startDate))}
								startLabel={formatDate(startDate)}
								endLabel={
									schedule.deadline === null
										? "No deadline"
										: formatDeadline(schedule.deadline, schedule.deadlineTime)
								}
								summary={`${completed} of ${total} tasks done since ${formatDate(startDate)}`}
							/>
						</Card>
					)}
				</>
			)}

			{contents.count === 0 ? (
				isPending ? (
					<LoadingState />
				) : (
					<EmptyState
						title="Nothing in this group yet."
						description="Add checklists, trackers and tags — any mix of them."
					/>
				)
			) : (
				<VStack gap={3}>
					<HStack gap={1} hAlign="end" vAlign="center">
						<ListOrderMenu
							order={order}
							onChange={setOrder}
							newestLabel="Newest added first"
							hasPriority
						/>
						{canManageContent ? (
							<>
								<SelectButton onClick={pick.start} />
								<ArrangeButton onClick={() => setIsArranging(true)} />
							</>
						) : null}
					</HStack>
					<VStack gap={5}>
						<Section
							kind="checklist"
							title="Checklists"
							count={shown.checklists.length}
						>
							<ArrangedCards
								items={shown.checklists}
								idOf={(checklist) => checklist.checklistId}
								render={(checklist) => (
									<ChecklistCard checklist={checklist} groupId={groupId} />
								)}
								pick={{ mode: pick, labelOf: (checklist) => checklist.title }}
							/>
						</Section>
						<Section
							kind="tracker"
							title="Trackers"
							count={shown.trackers.length}
						>
							<ArrangedCards
								items={shown.trackers}
								idOf={(tracker) => tracker.trackerId}
								render={(tracker) => (
									<TrackerCard tracker={tracker} tags={tags} />
								)}
								pick={{ mode: pick, labelOf: (tracker) => tracker.title }}
							/>
						</Section>
						<Section kind="tag" title="Tags" count={shown.tags.length}>
							<ArrangedCards
								items={shown.tags}
								idOf={(tag) => tag.tagId}
								render={(tag) => <TagCard tag={tag} />}
								pick={{ mode: pick, labelOf: (tag) => `#${tag.name}` }}
							/>
						</Section>
					</VStack>
				</VStack>
			)}

			{pick.isPicking ? (
				<GroupPickedBar
					group={group}
					contents={contents}
					picked={pick.picked}
					onDone={pick.stop}
				/>
			) : null}

			<ArrangeDialog
				isOpen={isArranging}
				onOpenChange={setIsArranging}
				noun="items"
				items={arrangeRows(group, contents)}
				arrangement={{ order: group.order ?? [] }}
				onSave={(next) => {
					apply({
						kind: "group.update",
						groupId,
						patch: { order: next.order },
					});
					setIsArranging(false);
				}}
			/>

			<ItemPickerDialog
				isOpen={isAdding}
				onOpenChange={setIsAdding}
				title={`Add to ${group.name}`}
				kinds={GROUP_ITEM_KINDS}
				picked={group.items}
				onToggle={(item) => toggle(group, item as GroupItem)}
			/>

			<GroupImportDialog
				isOpen={isImporting}
				onOpenChange={setIsImporting}
				group={group}
				onSubmit={(values) => void importOutline(values.checklists)}
			/>

			<GroupFormDialog
				isOpen={isEditing}
				onOpenChange={setIsEditing}
				group={group}
				onSubmit={(values) => {
					const patch = {
						...(values.name === group.name ? {} : { name: values.name }),
						...(values.color === group.color ? {} : { color: values.color }),
						...(values.startDate === startDate
							? {}
							: { startDate: values.startDate }),
						...(values.deadline === schedule.deadline
							? {}
							: { deadline: values.deadline }),
						...(values.deadlineTime === schedule.deadlineTime
							? {}
							: { deadlineTime: values.deadlineTime }),
						...(JSON.stringify(values.items) === JSON.stringify(group.items)
							? {}
							: { items: values.items }),
					};
					// Saved unchanged is nothing to send.
					if (Object.keys(patch).length > 0) {
						apply({ kind: "group.update", groupId, patch });
					}
					setIsEditing(false);
				}}
			/>

			<AlertDialog
				isOpen={isDeleting}
				onOpenChange={setIsDeleting}
				title={`Delete ${group.name}?`}
				description="The group will be deleted. Everything in it stays where it is."
				actionLabel="Delete"
				onAction={() => {
					apply({ kind: "group.delete", groupId });
					setIsDeleting(false);
					void navigate({ to: "/groups" });
				}}
			/>
		</VStack>
	);
}
