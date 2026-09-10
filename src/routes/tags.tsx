import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Token } from "@astryxdesign/core/Token";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { type Facet, FacetSummary } from "#/components/common/facet-summary";
import { LoadingState } from "#/components/common/loading-state";
import { ShowMore } from "#/components/common/show-more";
import { ErrorNotice } from "#/components/common/states";
import { TagFormDialog } from "#/components/tags/tag-form-dialog";
import { TaggedTaskRow } from "#/components/tags/tagged-task-row";
import { createTag, useApplyChange } from "#/lib/changes";
import { useShowMore } from "#/lib/use-show-more";
import { deferQuery, primeQuery } from "#/queries/prime";
import type { TaggedTask } from "#/queries/system";
import { searchIndexQuery } from "#/queries/system";
import { tagsQuery } from "#/queries/tags";
import type { Tag } from "#/schemas/tag";

export const Route = createFileRoute("/tags")({
	loader: ({ context }) => {
		// The tasks under each tag; the tags themselves are what the screen is.
		deferQuery(context.queryClient, searchIndexQuery());

		return primeQuery(context.queryClient, tagsQuery());
	},
	component: TagsPage,
});

/** The tag currently being read, with `UNTAGGED` for the tasks carrying none. */
const UNTAGGED = "untagged";

function TagsPage() {
	const { apply } = useApplyChange();

	const [selected, setSelected] = useState<string>(UNTAGGED);
	const [editing, setEditing] = useState<Tag | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [deleting, setDeleting] = useState<Tag | null>(null);

	const tagsResult = useQuery(tagsQuery());
	const index = useQuery(searchIndexQuery());

	const allTags = tagsResult.data ?? [];

	const tasks = index.data?.tasks ?? [];

	const tasksByTag = useMemo(() => {
		const grouped = new Map<string, Array<TaggedTask>>();
		for (const task of tasks) {
			for (const tagId of task.tagIds) {
				const existing = grouped.get(tagId);
				if (existing) existing.push(task);
				else grouped.set(tagId, [task]);
			}
		}
		return grouped;
	}, [tasks]);

	const untagged = useMemo(
		() => tasks.filter((task) => task.tagIds.length === 0),
		[tasks],
	);

	/*
	 * Every tag, plus the tasks carrying none.
	 *
	 * Untagged is a group like any other here: it is where most tasks start, and
	 * leaving it out of the summary would hide the number the screen exists to
	 * shrink.
	 */
	const facets: Array<Facet> = [
		...allTags.map((tag) => {
			const carried = tasksByTag.get(tag.tagId) ?? [];

			return {
				value: tag.tagId,
				label: tag.name,
				mark: <Token size="sm" color={tag.color} label={tag.name} />,
				total: carried.length,
				done: carried.filter((task) => task.completed).length,
			};
		}),
		{
			value: UNTAGGED,
			label: "Untagged",
			mark: <Icon icon={TagIcon} size="sm" color="secondary" />,
			total: untagged.length,
			done: untagged.filter((task) => task.completed).length,
		},
	];

	const shown =
		selected === UNTAGGED ? untagged : (tasksByTag.get(selected) ?? []);
	const shownTag = allTags.find((tag) => tag.tagId === selected) ?? null;
	const paging = useShowMore(shown);

	/** A different group is a different list, so it starts from its first page. */
	function select(value: string) {
		setSelected(value);
		paging.reset();
	}

	const isLoading = tagsResult.isPending || index.isPending;
	const failure = tagsResult.error ?? index.error;

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

			{tagsResult.isError || index.isError ? (
				<ErrorNotice
					error={failure}
					onRetry={() => {
						void tagsResult.refetch();
						void index.refetch();
					}}
				/>
			) : isLoading ? (
				<LoadingState />
			) : (
				<>
					<FacetSummary facets={facets} selected={selected} onSelect={select} />

					{allTags.length === 0 ? (
						<EmptyState
							title="No tags yet."
							description="Create a tag to group tasks across your checklists."
						/>
					) : (
						<VStack gap={2}>
							<HStack gap={2} hAlign="between" vAlign="center">
								<Selector
									label="Tag to show"
									size="sm"
									variant="ghost"
									hasSearch={facets.length > 8}
									value={selected}
									onChange={select}
									options={facets.map((facet) => ({
										value: facet.value,
										label: facet.label,
										description: `${facet.total - facet.done} left of ${facet.total}`,
									}))}
								/>

								{shownTag === null ? null : (
									<HStack gap={1} vAlign="center">
										<IconButton
											label={`Rename or recolour ${shownTag.name}`}
											tooltip="Rename or recolour"
											variant="ghost"
											size="sm"
											icon={<Pencil aria-hidden />}
											onClick={() => setEditing(shownTag)}
										/>
										<IconButton
											label={`Delete ${shownTag.name}`}
											tooltip="Delete tag"
											variant="ghost"
											size="sm"
											icon={<Trash2 aria-hidden />}
											onClick={() => setDeleting(shownTag)}
										/>
									</HStack>
								)}
							</HStack>

							{shown.length === 0 ? (
								<EmptyState
									isCompact
									title="Nothing here."
									description={
										selected === UNTAGGED
											? "Every task carries a tag."
											: "Nothing carries this tag yet."
									}
								/>
							) : (
								<Card padding={0}>
									<VStack gap={0} paddingBlock={2}>
										{paging.shown.map((task) => (
											<TaggedTaskRow
												key={task.taskId}
												task={task}
												tags={allTags}
											/>
										))}
										<ShowMore
											hidden={paging.hidden}
											onShowMore={paging.showMore}
										/>
									</VStack>
								</Card>
							)}
						</VStack>
					)}
				</>
			)}

			<TagFormDialog
				isOpen={isCreating}
				onOpenChange={setIsCreating}
				existingNames={allTags.map((tag) => tag.name)}
				onSubmit={(values) => {
					createTag(apply, values);
					setIsCreating(false);
				}}
			/>

			<TagFormDialog
				isOpen={editing !== null}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
				tag={editing ?? undefined}
				existingNames={allTags.map((tag) => tag.name)}
				onSubmit={(values) => {
					if (editing) {
						apply({ kind: "tag.update", tagId: editing.tagId, patch: values });
					}
					setEditing(null);
				}}
			/>

			<AlertDialog
				isOpen={deleting !== null}
				onOpenChange={(open) => {
					if (!open) setDeleting(null);
				}}
				title={`Delete the ${deleting?.name ?? ""} tag?`}
				description={`It will be taken off ${
					deleting ? (tasksByTag.get(deleting.tagId)?.length ?? 0) : 0
				} task(s). The tasks themselves are not deleted.`}
				actionLabel="Delete"
				onAction={() => {
					if (deleting) apply({ kind: "tag.delete", tagId: deleting.tagId });
					setDeleting(null);
				}}
			/>
		</VStack>
	);
}
