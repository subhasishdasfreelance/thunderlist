import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrangeDialog } from "#/components/common/arrange-dialog";
import {
	ArrangeButton,
	ArrangedCards,
	ListOrderMenu,
	SelectButtons,
	saveArrangement,
	useArrangedList,
} from "#/components/common/arranged-list";
import { editableTag } from "#/components/common/items-edit-dialog";
import { ListPanel } from "#/components/common/list-panel";
import { LoadingState } from "#/components/common/loading-state";
import { Pickable } from "#/components/common/pickable";
import { PickedItemsBar } from "#/components/common/picked-items-bar";
import { SectionSpinner } from "#/components/common/section-spinner";
import { ErrorNotice } from "#/components/common/states";
import { TagCard } from "#/components/tags/tag-card";
import { UntaggedCard } from "#/components/tags/untagged-card";
import { tagsBehind } from "#/lib/behind";
import { useApplyChange } from "#/lib/changes";
import { useNow } from "#/lib/use-now";
import { usePickMode } from "#/lib/use-pick-mode";
import { usePermissions } from "#/lib/use-team";
import { deferQuery, primeQuery } from "#/queries/prime";
import { arrangementsQuery } from "#/queries/space";
import { searchIndexQuery } from "#/queries/system";
import { tagSummariesQuery } from "#/queries/tags";
import type { TagSummary } from "#/schemas/tag";

const tagIdOf = (tag: TagSummary) => tag.tagId;
const createdAtOf = (tag: TagSummary) => tag.createdAt;
const nameOf = (tag: TagSummary) => tag.name;

export const Route = createFileRoute("/tags/")({
	loader: ({ context }) => {
		// The untagged card after the tags; the tags are what the screen is.
		deferQuery(context.queryClient, searchIndexQuery());

		// The order is the space's, and read with the list, so it
		// is drawn in them from the start rather than rearranged after.
		return Promise.all([
			primeQuery(context.queryClient, tagSummariesQuery()),
			primeQuery(context.queryClient, arrangementsQuery()),
		]).then(() => undefined);
	},
	component: TagsPage,
});

/**
 * Every tag, as the Checklists screen shows every checklist: a card each, with
 * its progress and pace, opening onto its own page.
 */
function TagsPage() {
	const { apply } = useApplyChange();
	const [isArranging, setIsArranging] = useState(false);
	const { canManageContent } = usePermissions();
	// Several picked out, to change together; see `usePickMode`.
	const pick = usePickMode(canManageContent);

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

	// Your order, newest first or most behind first; see `useArrangedList`. Behind is judged on the viewer's clock, so only once
	// the browser has it.
	const now = useNow();
	const behind = useMemo(() => (now === null ? null : tagsBehind(now)), [now]);
	const arranged = useArrangedList({
		list: "tags",
		items: tags,
		idOf: tagIdOf,
		createdAt: createdAtOf,
		nameOf: nameOf,
		compareBehind: behind,
	});

	// In the grid after the tags, the same size as theirs; not a tag, so
	// nothing to pick.
	const untaggedCard =
		index.data === undefined || untagged.length === 0 ? null : (
			<Pickable
				isPicking={pick.isPicking}
				isPicked={false}
				isPickable={false}
				label="Untagged"
				onToggle={() => {}}
			>
				<UntaggedCard tasks={untagged} checklists={index.data.checklists} />
			</Pickable>
		);

	return (
		<VStack gap={4}>
			<Heading level={1}>Tags</Heading>

			{isError ? (
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			) : isPending ? (
				<LoadingState />
			) : (
				<VStack gap={3}>
					{tags.length === 0 ? (
						<>
							<EmptyState
								title="No tags yet."
								description="Write #name in any task to make one."
							/>
							{untaggedCard === null ? null : (
								<div className="thunderlist-card-grid">
									<div>{untaggedCard}</div>
								</div>
							)}
						</>
					) : (
						<>
							<ListPanel
								controls={
									<HStack gap={2} hAlign="between" vAlign="center">
										{/* Untagged is not a tag, so its card is not counted. */}
										<Text type="label" weight="semibold" color="secondary">
											{tags.length} {tags.length === 1 ? "tag" : "tags"}
										</Text>
										<HStack gap={1} vAlign="center">
											<ListOrderMenu
												order={arranged.order}
												onChange={arranged.setOrder}
											/>
											{canManageContent ? (
												<>
													<SelectButtons mode={pick} />
													<ArrangeButton onClick={() => setIsArranging(true)} />
												</>
											) : null}
										</HStack>
									</HStack>
								}
							/>
							<ArrangedCards
								items={arranged.ordered}
								idOf={tagIdOf}
								render={(tag) => <TagCard tag={tag} />}
								after={untaggedCard}
								pick={{
									mode: pick,
									labelOf: (tag) => `#${tag.name}`,
									// Today is everyone's, and stays.
									isPickable: (tag) => tag.special == null,
								}}
							/>
						</>
					)}

					{index.isError ? (
						<ErrorNotice
							error={index.error}
							onRetry={() => void index.refetch()}
						/>
					) : index.isPending ? (
						<SectionSpinner label="Loading untagged tasks…" />
					) : null}
				</VStack>
			)}

			{pick.isPicking ? (
				<PickedItemsBar
					of="tag"
					items={tags.flatMap((tag) =>
						pick.picked.has(tag.tagId)
							? [
									{
										id: tag.tagId,
										access: tag.access,
										editable: editableTag(tag),
									},
								]
							: [],
					)}
					onDone={pick.stop}
				/>
			) : null}

			<ArrangeDialog
				isOpen={isArranging}
				onOpenChange={setIsArranging}
				noun="tags"
				items={arranged.byHand.map((tag) => ({
					id: tag.tagId,
					label: `#${tag.name}`,
				}))}
				arrangement={arranged.arrangement}
				onSave={(next) => {
					saveArrangement(apply, "tags", next);
					setIsArranging(false);
				}}
			/>
		</VStack>
	);
}
