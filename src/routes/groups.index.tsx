import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardPaste, Plus } from "lucide-react";
import { useState } from "react";
import { LoadingState } from "#/components/common/loading-state";
import { ErrorNotice } from "#/components/common/states";
import { GroupCard } from "#/components/groups/group-card";
import { useGroupContents } from "#/components/groups/group-contents";
import { GroupFormDialog } from "#/components/groups/group-form-dialog";
import {
	GroupImportDialog,
	type GroupImportValues,
} from "#/components/groups/group-import-dialog";
import { createTagResolver, importGroup, useApplyChange } from "#/lib/changes";
import { createId, ID_PREFIX } from "#/lib/ids";
import { usePermissions } from "#/lib/use-team";
import { checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { groupsQuery } from "#/queries/space";
import { tagSummariesQuery, tagsQuery } from "#/queries/tags";
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
	const [isImporting, setIsImporting] = useState(false);
	const queryClient = useQueryClient();
	const { apply } = useApplyChange();
	const { canManageContent } = usePermissions();
	const { contentsOf } = useGroupContents();

	const { data, isPending, isError, error, refetch } = useQuery(groupsQuery());
	const groups = data ?? [];

	/**
	 * A group and a checklist for each heading, in one change. The tags its
	 * lines write are read first, so a tag that exists is not made again.
	 */
	async function importOutline(values: GroupImportValues) {
		setIsImporting(false);
		const tags = await queryClient.ensureQueryData(tagsQuery());
		importGroup(
			apply,
			values,
			createTagResolver(apply, tags, canManageContent),
		);
	}

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<Heading level={1}>Groups</Heading>
				{canManageContent ? (
					<HStack gap={2}>
						<Button
							label="Import"
							variant="secondary"
							icon={<ClipboardPaste aria-hidden />}
							onClick={() => setIsImporting(true)}
						/>
						<Button
							label="New group"
							variant="primary"
							icon={<Plus aria-hidden />}
							onClick={() => setIsCreating(true)}
						/>
					</HStack>
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
					<div className="thunderlist-card-grid">
						{groups.map((group) => (
							<GroupCard
								key={group.groupId}
								group={group}
								contents={contentsOf(group)}
							/>
						))}
					</div>
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

			<GroupImportDialog
				isOpen={isImporting}
				onOpenChange={setIsImporting}
				onSubmit={(values) => void importOutline(values)}
			/>
		</VStack>
	);
}
