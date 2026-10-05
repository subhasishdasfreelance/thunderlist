import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { SelectAllButton } from "#/components/common/arranged-list";
import { BackButton } from "#/components/common/back-button";
import { LoadingState } from "#/components/common/loading-state";
import { ErrorNotice } from "#/components/common/states";
import { IndexTaskList } from "#/components/tasks/index-task-list";
import { usePages } from "#/lib/use-pages";
import { useTaskSelection } from "#/lib/use-task-selection";
import { usePermissions } from "#/lib/use-team";
import { checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { searchIndexQuery } from "#/queries/system";
import { tagsQuery } from "#/queries/tags";

export const Route = createFileRoute("/tags/untagged")({
	loader: ({ context }) => {
		// Tags colour the titles and light the Today buttons, and the checklists
		// give each row its stages and somewhere to move to; the untagged tasks
		// are the screen.
		deferQuery(context.queryClient, tagsQuery());
		deferQuery(context.queryClient, checklistsQuery());

		return primeQuery(context.queryClient, searchIndexQuery());
	},
	component: UntaggedPage,
});

/**
 * The tasks carrying no tag, opened from their card on the Tags screen.
 *
 * Not a tag, so none of a tag's page: no dates, no pace, nothing to edit or
 * delete about the page itself. Only the list, a page at a time, each row the
 * one a checklist draws — ticked, flagged, tagged or moved right here, as on
 * the Priority screen; see `IndexTaskList`.
 */
function UntaggedPage() {
	const index = useQuery(searchIndexQuery());

	const untagged = useMemo(
		() => (index.data?.tasks ?? []).filter((task) => task.tagIds.length === 0),
		[index.data],
	);
	const paging = usePages(untagged);
	const { canUpdateTasks } = usePermissions();
	// The rows picked out; see `IndexTaskList`.
	const selection = useTaskSelection();

	return (
		<VStack gap={4}>
			<BackButton to="/tags" label="Tags" />
			<HStack gap={2} hAlign="between" vAlign="center">
				<Heading level={1}>Untagged</Heading>
				{canUpdateTasks && untagged.length > 0 ? (
					<SelectAllButton onClick={selection.pickAll} />
				) : null}
			</HStack>

			{index.isError ? (
				<ErrorNotice error={index.error} onRetry={() => void index.refetch()} />
			) : index.isPending ? (
				<LoadingState />
			) : untagged.length === 0 ? (
				<EmptyState
					title="Every task has a tag."
					description="Any task written without a #name shows up here."
				/>
			) : (
				<IndexTaskList
					tasks={paging.shown}
					page={paging.page}
					total={paging.total}
					onPageChange={paging.setPage}
					selection={selection}
				/>
			)}
		</VStack>
	);
}
