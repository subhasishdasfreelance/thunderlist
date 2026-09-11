import { Button } from "@astryxdesign/core/Button";
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
import { ErrorNotice } from "#/components/common/states";
import { TagCard } from "#/components/tags/tag-card";
import { TagFormDialog } from "#/components/tags/tag-form-dialog";
import { UntaggedCard } from "#/components/tags/untagged-card";
import { createTag, useApplyChange } from "#/lib/changes";
import { lagFraction } from "#/lib/progress";
import { useNow } from "#/lib/use-now";
import { deferQuery, primeQuery } from "#/queries/prime";
import { searchIndexQuery } from "#/queries/system";
import { tagSummariesQuery } from "#/queries/tags";
import { type TagSummary, tagStartDate } from "#/schemas/tag";

/**
 * How far behind a tag is, worst first — the same measure its pace label is
 * drawn from, as on the Checklists screen.
 */
function lag(tag: TagSummary, now: number): number {
	return lagFraction({
		startDate: tagStartDate(tag),
		deadline: tag.deadline,
		deadlineTime: tag.deadlineTime,
		dailyWindow: tag.dailyWindow,
		now,
		fractionComplete: tag.progress.percent / 100,
	});
}

export const Route = createFileRoute("/tags/")({
	loader: ({ context }) => {
		// The untagged card after the tags; the tags are what the screen is.
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
	 * They belong to no tag, but they are where most tasks start, and leaving
	 * them off would hide the number this screen exists to shrink. So they get
	 * a card of their own, after the tags in either order: with no dates there
	 * is no pace to sort them by.
	 */
	const untagged = useMemo(
		() => (index.data?.tasks ?? []).filter((task) => task.tagIds.length === 0),
		[index.data],
	);

	// Judged on the viewer's clock, so sorted only once the browser has it.
	const now = useNow();
	const ordered =
		isBehindFirst && now !== null
			? [...tags].sort((a, b) => lag(b, now) - lag(a, now))
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
				<VStack gap={3}>
					{tags.length === 0 ? (
						<EmptyState
							title="No tags yet."
							description="Create one here, or write #name in any task."
						/>
					) : (
						<>
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
						</>
					)}

					{index.isError ? (
						<ErrorNotice
							error={index.error}
							onRetry={() => void index.refetch()}
						/>
					) : index.isPending ? (
						<SectionSpinner label="Loading untagged tasks…" />
					) : untagged.length === 0 ? null : (
						<UntaggedCard tasks={untagged} />
					)}
				</VStack>
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
