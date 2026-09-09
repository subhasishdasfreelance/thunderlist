import { AlertDialog } from "@astryxdesign/core/AlertDialog";
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
import { type Stat, StatGrid } from "#/components/common/stat-grid";
import { CardListSkeleton, ErrorNotice } from "#/components/common/states";
import { TagCard } from "#/components/tags/tag-card";
import { TagFormDialog } from "#/components/tags/tag-form-dialog";
import { TaggedTaskRow } from "#/components/tags/tagged-task-row";
import {
	queueCreateTag,
	queueDeleteTag,
	queueUpdateTag,
} from "#/lib/pending/actions";
import {
	overlayTaggedTasks,
	overlayTags,
	type TaggedTask,
} from "#/lib/pending/overlay-tags";
import { usePendingChanges } from "#/lib/pending/store";
import { primeQuery } from "#/queries/prime";
import { searchIndexQuery } from "#/queries/system";
import { tagsQuery } from "#/queries/tags";
import type { Tag } from "#/schemas/tag";

export const Route = createFileRoute("/tags")({
	loader: ({ context }) => primeQuery(context.queryClient, tagsQuery()),
	component: TagsPage,
});

/**
 * The headline figures for the whole screen.
 *
 * Coverage is the one worth watching: tags are only useful if most tasks carry
 * one, and an untagged pile is the thing that quietly makes the screen useless.
 */
function tagStats(
	tags: ReadonlyArray<Tag>,
	tasks: ReadonlyArray<TaggedTask>,
	tasksByTag: Map<string, Array<TaggedTask>>,
): Array<Stat> {
	const untagged = tasks.filter((task) => task.tagIds.length === 0).length;
	const tagged = tasks.length - untagged;

	const busiest = [...tasksByTag.entries()].reduce<{
		name: string;
		count: number;
	} | null>((best, [tagId, list]) => {
		if (best !== null && list.length <= best.count) return best;
		const tag = tags.find((candidate) => candidate.tagId === tagId);
		return tag ? { name: tag.name, count: list.length } : best;
	}, null);

	return [
		{ label: "Tags", value: `${tags.length}` },
		{ label: "Tagged tasks", value: `${tagged}` },
		{ label: "Untagged", value: `${untagged}` },
		{
			label: "Coverage",
			value:
				tasks.length === 0
					? "—"
					: `${Math.round((tagged / tasks.length) * 100)}%`,
		},
		{
			label: "Busiest tag",
			value: busiest === null ? "—" : `${busiest.name} (${busiest.count})`,
		},
	];
}

function TagsPage() {
	const queued = usePendingChanges();

	const [editing, setEditing] = useState<Tag | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [deleting, setDeleting] = useState<Tag | null>(null);

	const tagsResult = useQuery(tagsQuery());
	const index = useQuery(searchIndexQuery());

	const allTags = useMemo(
		() => overlayTags(tagsResult.data ?? [], queued),
		[tagsResult.data, queued],
	);

	const tasks = useMemo(
		() => overlayTaggedTasks(index.data?.tasks ?? [], queued),
		[index.data, queued],
	);

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

	const stats = tagStats(allTags, tasks, tasksByTag);

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
				<CardListSkeleton />
			) : (
				<>
					{tasks.length === 0 ? null : <StatGrid stats={stats} />}

					{allTags.length === 0 ? (
						<EmptyState
							title="No tags yet."
							description="Create a tag to group tasks across your checklists."
						/>
					) : (
						<VStack gap={3}>
							{allTags.map((tag) => (
								<TagCard
									key={tag.tagId}
									tag={tag}
									tasks={tasksByTag.get(tag.tagId) ?? []}
									allTags={allTags}
									onEdit={() => setEditing(tag)}
									onDelete={() => setDeleting(tag)}
								/>
							))}
						</VStack>
					)}

					{untagged.length === 0 ? null : (
						<VStack gap={2}>
							<Text type="label" weight="semibold">
								Untagged tasks
							</Text>
							<Card padding={0}>
								<VStack gap={0} paddingInline={4} paddingBlock={2}>
									{untagged.map((task) => (
										<TaggedTaskRow
											key={task.taskId}
											task={task}
											tags={allTags}
										/>
									))}
								</VStack>
							</Card>
						</VStack>
					)}
				</>
			)}

			<TagFormDialog
				isOpen={isCreating}
				onOpenChange={setIsCreating}
				existingNames={allTags.map((tag) => tag.name)}
				onSubmit={(values) => {
					queueCreateTag(values);
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
					if (editing) queueUpdateTag(editing, values);
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
				} task(s) when you save your changes. The tasks themselves are not deleted.`}
				actionLabel="Delete"
				onAction={() => {
					if (deleting) queueDeleteTag(deleting);
					setDeleting(null);
				}}
			/>
		</VStack>
	);
}
