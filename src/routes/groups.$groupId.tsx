import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ChecklistCard } from "#/components/checklists/checklist-card";
import { BackButton } from "#/components/common/back-button";
import { numberTitle } from "#/components/common/item-number";
import {
	ITEM_KIND_ICONS,
	ItemPickerDialog,
} from "#/components/common/item-picker-dialog";
import { LoadingState } from "#/components/common/loading-state";
import { ProgressMeter } from "#/components/common/progress-meter";
import { ErrorNotice } from "#/components/common/states";
import { GroupBadge } from "#/components/groups/group-card";
import {
	describeContents,
	useGroupContents,
} from "#/components/groups/group-contents";
import { GroupFormDialog } from "#/components/groups/group-form-dialog";
import { TagCard } from "#/components/tags/tag-card";
import { TrackerCard } from "#/components/trackers/tracker-card";
import { useApplyChange } from "#/lib/changes";
import { usePermissions } from "#/lib/use-team";
import { checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { groupsQuery } from "#/queries/space";
import { tagSummariesQuery, tagsQuery } from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import type { ItemKind } from "#/schemas/common";
import {
	GROUP_ITEM_KINDS,
	type Group,
	type GroupItem,
	sameItem,
} from "#/schemas/group";

export const Route = createFileRoute("/groups/$groupId")({
	loader: ({ context }) => {
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
 * and how far along all of it is together. Adding to it opens the picker;
 * renaming it, recolouring it and taking things out are in its dialog.
 */
function GroupPage() {
	const { groupId } = Route.useParams();
	const navigate = useNavigate();
	const { apply } = useApplyChange();
	const { canManageContent } = usePermissions();
	const [isEditing, setIsEditing] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isAdding, setIsAdding] = useState(false);

	const { data, isError, error, refetch } = useQuery(groupsQuery());
	const tags = useQuery(tagsQuery()).data ?? [];
	const { contentsOf, isPending } = useGroupContents();
	const group = data?.find((each) => each.groupId === groupId);

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

			<HStack gap={2} hAlign="between" vAlign="start">
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
				<ProgressMeter
					label={`${group.name} progress`}
					percent={contents.percent}
					elapsed={null}
					footnote={`${contents.percent}% across everything in it`}
				/>
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
				<VStack gap={5}>
					<Section
						kind="checklist"
						title="Checklists"
						count={contents.checklists.length}
					>
						{contents.checklists.map((checklist) => (
							<ChecklistCard
								key={checklist.checklistId}
								checklist={checklist}
							/>
						))}
					</Section>
					<Section
						kind="tracker"
						title="Trackers"
						count={contents.trackers.length}
					>
						{contents.trackers.map((tracker) => (
							<TrackerCard
								key={tracker.trackerId}
								tracker={tracker}
								tags={tags}
							/>
						))}
					</Section>
					<Section kind="tag" title="Tags" count={contents.tags.length}>
						{contents.tags.map((tag) => (
							<TagCard key={tag.tagId} tag={tag} />
						))}
					</Section>
				</VStack>
			)}

			<ItemPickerDialog
				isOpen={isAdding}
				onOpenChange={setIsAdding}
				title={`Add to ${group.name}`}
				kinds={GROUP_ITEM_KINDS}
				picked={group.items}
				onToggle={(item) => toggle(group, item as GroupItem)}
			/>

			<GroupFormDialog
				isOpen={isEditing}
				onOpenChange={setIsEditing}
				group={group}
				onSubmit={(values) => {
					const patch = {
						...(values.name === group.name ? {} : { name: values.name }),
						...(values.color === group.color ? {} : { color: values.color }),
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
