import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/Stack";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { BackButton } from "#/components/common/back-button";
import { LoadingState } from "#/components/common/loading-state";
import { ShowMore } from "#/components/common/show-more";
import { ErrorNotice } from "#/components/common/states";
import { TaggedTaskRow } from "#/components/tags/tagged-task-row";
import { useShowMore } from "#/lib/use-show-more";
import { deferQuery, primeQuery } from "#/queries/prime";
import { searchIndexQuery } from "#/queries/system";
import { tagsQuery } from "#/queries/tags";

export const Route = createFileRoute("/tags/untagged")({
	loader: ({ context }) => {
		// Tags only colour the titles; the untagged tasks are the screen.
		deferQuery(context.queryClient, tagsQuery());

		return primeQuery(context.queryClient, searchIndexQuery());
	},
	component: UntaggedPage,
});

/**
 * The tasks carrying no tag, opened from their card on the Tags screen.
 *
 * Not a tag, so none of a tag's page: no dates, no pace, nothing to edit or
 * delete. Only the list, a page at a time, each row opening its task where it
 * lives — where writing `#name` into the title is how it gets a tag.
 */
function UntaggedPage() {
	const index = useQuery(searchIndexQuery());
	const tagsResult = useQuery(tagsQuery());

	const tags = tagsResult.data ?? [];

	const untagged = useMemo(
		() => (index.data?.tasks ?? []).filter((task) => task.tagIds.length === 0),
		[index.data],
	);
	const paging = useShowMore(untagged);

	return (
		<VStack gap={4}>
			<BackButton to="/tags" label="Tags" />
			<Heading level={1}>Untagged</Heading>

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
				<Card padding={0}>
					<VStack gap={0} paddingBlock={2}>
						{paging.shown.map((task, position) => (
							<TaggedTaskRow
								key={task.taskId}
								task={task}
								tags={tags}
								hasDivider={position > 0}
							/>
						))}
						<ShowMore hidden={paging.hidden} onShowMore={paging.showMore} />
					</VStack>
				</Card>
			)}
		</VStack>
	);
}
