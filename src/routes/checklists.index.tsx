import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ChecklistCard } from "#/components/checklists/checklist-card";
import { ChecklistFormDialog } from "#/components/checklists/checklist-form-dialog";
import { StatGrid } from "#/components/common/stat-grid";
import { CardListSkeleton, ErrorNotice } from "#/components/common/states";
import {
	type ChecklistValues,
	queueCreateChecklist,
} from "#/lib/pending/actions";
import { overlayChecklists } from "#/lib/pending/overlay-checklists";
import { usePendingChanges } from "#/lib/pending/store";
import { checklistsQuery } from "#/queries/checklists";
import { primeQuery } from "#/queries/prime";

export const Route = createFileRoute("/checklists/")({
	loader: ({ context }) => primeQuery(context.queryClient, checklistsQuery()),
	component: ChecklistsPage,
});

function ChecklistsPage() {
	const navigate = useNavigate();
	const [isFormOpen, setIsFormOpen] = useState(false);
	const queued = usePendingChanges();

	const { data, isPending, isError, error, refetch } = useQuery(
		checklistsQuery(),
	);

	const checklists = useMemo(
		() => overlayChecklists(data ?? [], queued),
		[data, queued],
	);

	// Across every checklist, so the screen answers "where does all this stand"
	// before you open any single one.
	const totals = checklists.reduce(
		(sum, checklist) => ({
			tasks: sum.tasks + checklist.progress.total,
			done: sum.done + checklist.progress.completed,
			behind: sum.behind + (checklist.status === "behind" ? 1 : 0),
			withDeadline: sum.withDeadline + (checklist.deadline === null ? 0 : 1),
		}),
		{ tasks: 0, done: 0, behind: 0, withDeadline: 0 },
	);

	const stats = [
		{ label: "Checklists", value: `${checklists.length}` },
		{ label: "Tasks", value: `${totals.tasks}` },
		{ label: "Done", value: `${totals.done}` },
		{
			label: "Complete",
			value:
				totals.tasks === 0
					? "—"
					: `${Math.round((totals.done / totals.tasks) * 100)}%`,
		},
		{ label: "With a deadline", value: `${totals.withDeadline}` },
		{ label: "Behind", value: `${totals.behind}` },
	];

	function create(values: ChecklistValues) {
		const checklistId = queueCreateChecklist(values);
		setIsFormOpen(false);
		// Drop straight into the new checklist so tasks can be added.
		void navigate({
			to: "/checklists/$checklistId",
			params: { checklistId },
		});
	}

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<Heading level={1}>Checklists</Heading>
				<Button
					label="New checklist"
					variant="primary"
					icon={<Plus aria-hidden />}
					onClick={() => setIsFormOpen(true)}
				/>
			</HStack>

			{checklists.length === 0 || isPending ? null : <StatGrid stats={stats} />}

			{isError ? (
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			) : isPending ? (
				<CardListSkeleton />
			) : checklists.length === 0 ? (
				<EmptyState
					title="No checklists yet."
					description="Create your first checklist to start tracking work."
				/>
			) : (
				<VStack gap={3}>
					<Text type="label" weight="semibold">
						Your Checklists
					</Text>
					{checklists.map((checklist) => (
						<ChecklistCard key={checklist.checklistId} checklist={checklist} />
					))}
				</VStack>
			)}

			<ChecklistFormDialog
				isOpen={isFormOpen}
				onOpenChange={setIsFormOpen}
				onSubmit={create}
			/>
		</VStack>
	);
}
