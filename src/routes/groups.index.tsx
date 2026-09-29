import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { LoadingState } from "#/components/common/loading-state";
import { ErrorNotice } from "#/components/common/states";
import { GroupCard } from "#/components/groups/group-card";
import { useGroupContents } from "#/components/groups/group-contents";
import { GroupFormDialog } from "#/components/groups/group-form-dialog";
import { useApplyChange } from "#/lib/changes";
import { createId, ID_PREFIX } from "#/lib/ids";
import { usePermissions } from "#/lib/use-team";
import { checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { groupsQuery } from "#/queries/space";
import { tagSummariesQuery } from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";

export const Route = createFileRoute("/groups/")({
	loader: ({ context }) => {
		// What they hold, for the figures on the cards; see `useGroupContents`.
		deferQuery(context.queryClient, checklistsQuery());
		deferQuery(context.queryClient, trackersQuery());
		deferQuery(context.queryClient, tagSummariesQuery());
		return primeQuery(context.queryClient, groupsQuery());
	},
	component: GroupsPage,
});

/**
 * Groups: named collections of checklists, trackers and tags, mixed however
 * suits — a card each, opening onto the group with everything in it.
 */
function GroupsPage() {
	const [isCreating, setIsCreating] = useState(false);
	const { apply } = useApplyChange();
	const { canManageContent } = usePermissions();
	const { contentsOf } = useGroupContents();

	const { data, isPending, isError, error, refetch } = useQuery(groupsQuery());
	const groups = data ?? [];

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<Heading level={1}>Groups</Heading>
				{canManageContent ? (
					<Button
						label="New group"
						variant="primary"
						icon={<Plus aria-hidden />}
						onClick={() => setIsCreating(true)}
					/>
				) : null}
			</HStack>

			{isError ? (
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			) : isPending ? (
				<LoadingState />
			) : groups.length === 0 ? (
				<EmptyState
					title="No groups yet."
					description="Gather checklists, trackers and tags that belong together — a project, a part of life — and see how they are going as one."
				/>
			) : (
				<VStack gap={3}>
					<Text type="label" weight="semibold">
						{groups.length} {groups.length === 1 ? "group" : "groups"}
					</Text>
					{groups.map((group) => (
						<GroupCard
							key={group.groupId}
							group={group}
							contents={contentsOf(group)}
						/>
					))}
				</VStack>
			)}

			<GroupFormDialog
				isOpen={isCreating}
				onOpenChange={setIsCreating}
				onSubmit={(values) => {
					apply({
						kind: "group.create",
						groupId: createId(ID_PREFIX.group),
						...values,
					});
					setIsCreating(false);
				}}
			/>
		</VStack>
	);
}
