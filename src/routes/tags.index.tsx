import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { LoadingState } from "#/components/common/loading-state";
import { OrderToggle } from "#/components/common/order-toggle";
import { SectionSpinner } from "#/components/common/section-spinner";
import { ShowMore } from "#/components/common/show-more";
import { ErrorNotice } from "#/components/common/states";
import { TagCard } from "#/components/tags/tag-card";
import { TagFormDialog } from "#/components/tags/tag-form-dialog";
import { TaggedTaskRow } from "#/components/tags/tagged-task-row";
import { createTag, useApplyChange } from "#/lib/changes";
import { lagFraction } from "#/lib/progress";
import { useShowMore } from "#/lib/use-show-more";
import { deferQuery, primeQuery } from "#/queries/prime";
import { searchIndexQuery } from "#/queries/system";
import { tagSummariesQuery } from "#/queries/tags";
import { type TagSummary, tagStartDate } from "#/schemas/tag";

/**
 * How far behind a tag is, worst first — the same measure its pace label is
 * drawn from, as on the Checklists screen.
 */
function lag(tag: TagSummary): number {
	return lagFraction({
		startDate: tagStartDate(tag),
		deadline: tag.deadline,
		fractionComplete: tag.progress.percent / 100,
	});
}

export const Route = createFileRoute("/tags/")({
	loader: ({ context }) => {
		// The untagged tasks below the cards; the tags are what the screen is.
		deferQuery(context.queryClient, searchIndexQuery());

		return primeQuery(context.queryClient, tagSummariesQuery());
	},
	component: TagsPage,
});

/**
 * Every tag, as the Checklists screen shows every checklist: a card each, with
 * its progress and pace, opening onto its own page.
 */
function TagsPage() {
	const { apply } = useApplyChange();
	const [isCreating, setIsCreating] = useState(false);
	const [isBehindFirst, setIsBehindFirst] = useState(false);

	const { data, isPending, isError, error, refetch } = useQuery(
		tagSummariesQuery(),
	);
	const index = useQuery(searchIndexQuery());

	const tags = data ?? [];

	/*
	 * The tasks carrying no tag.
	 *
	 * They belong to no card, but they are where most tasks start, and leaving
	 * them off would hide the number this screen exists to shrink.
	 */
	const untagged = useMemo(
		() => (index.data?.tasks ?? []).filter((task) => task.tagIds.length === 0),
		[index.data],
	);
	const paging = useShowMore(untagged);

	const ordered = isBehindFirst
		? [...tags].sort((a, b) => lag(b) - lag(a))
		: tags;

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<Heading level={1}>Tags</Heading>
				<Button
					label="New tag"
					variant="primary"
					icon={<Plus aria-hidden />}
					onClick={() => setIsCreating(true)}
				/>
			</HStack>

			{isError ? (
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			) : isPending ? (
				<LoadingState />
			) : (
				<>
					{tags.length === 0 ? (
						<EmptyState
							title="No tags yet."
							description="Create one here, or write #name in any task."
						/>
					) : (
						<VStack gap={3}>
							<HStack gap={2} hAlign="between" vAlign="center">
								<Text type="label" weight="semibold">
									Your Tags
								</Text>
								<OrderToggle
									isSorted={isBehindFirst}
									sortedLabel="Most behind first"
									defaultLabel="By name"
									onChange={setIsBehindFirst}
								/>
							</HStack>
							{ordered.map((tag) => (
								<TagCard key={tag.tagId} tag={tag} />
							))}
						</VStack>
					)}

					{index.isError ? (
						<ErrorNotice
							error={index.error}
							onRetry={() => void index.refetch()}
						/>
					) : index.isPending ? (
						<SectionSpinner label="Loading untagged tasks…" />
					) : untagged.length === 0 ? null : (
						<VStack gap={2}>
							<Text type="label" weight="semibold" color="secondary">
								Untagged · {untagged.length}
							</Text>
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
									<ShowMore
										hidden={paging.hidden}
										onShowMore={paging.showMore}
									/>
								</VStack>
							</Card>
						</VStack>
					)}
				</>
			)}

			<TagFormDialog
				isOpen={isCreating}
				onOpenChange={setIsCreating}
				existingNames={tags.map((tag) => tag.name)}
				onSubmit={(values) => {
					createTag(apply, values);
					setIsCreating(false);
				}}
			/>
		</VStack>
	);
}
