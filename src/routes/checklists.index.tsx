import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ChecklistCard } from "#/components/checklists/checklist-card";
import { ChecklistFormDialog } from "#/components/checklists/checklist-form-dialog";
import { LoadingState } from "#/components/common/loading-state";
import { OrderToggle } from "#/components/common/order-toggle";
import { ErrorNotice } from "#/components/common/states";
import {
	type ChecklistValues,
	createChecklist,
	useApplyChange,
} from "#/lib/changes";
import { lagFraction } from "#/lib/progress";
import { checklistsQuery } from "#/queries/checklists";
import { primeQuery } from "#/queries/prime";
import type { ChecklistSummary } from "#/schemas/checklist";

/**
 * How far behind a checklist is, worst first.
 *
 * The same measure the pace label on the card is drawn from, so the order
 * agrees with what each card says about itself.
 */
function lag(checklist: ChecklistSummary): number {
	return lagFraction({
		startDate: checklist.startDate,
		deadline: checklist.deadline,
		fractionComplete: checklist.progress.percent / 100,
	});
}

export const Route = createFileRoute("/checklists/")({
	loader: ({ context }) => primeQuery(context.queryClient, checklistsQuery()),
	component: ChecklistsPage,
});

function ChecklistsPage() {
	const navigate = useNavigate();
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [isBehindFirst, setIsBehindFirst] = useState(false);
	const { apply } = useApplyChange();

	const { data, isPending, isError, error, refetch } = useQuery(
		checklistsQuery(),
	);

	const checklists = data ?? [];

	/*
	 * Behind first, or the order they were made in.
	 *
	 * A page of totals answered "how is all of this going" with one number that
	 * was true of nothing in particular. The useful version of that question is
	 * "which of these needs me", and that is an ordering of the cards already on
	 * the screen rather than a row of figures above them.
	 */
	const ordered = isBehindFirst
		? [...checklists].sort((a, b) => lag(b) - lag(a))
		: checklists;

	function create(values: ChecklistValues) {
		const checklistId = createChecklist(apply, values);
		setIsFormOpen(false);
		// Drop straight into the new checklist so tasks can be added.
		void navigate({
			to: "/checklists/$checklistId",
			params: { checklistId },
			search: { task: undefined },
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

			{isError ? (
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			) : isPending ? (
				<LoadingState />
			) : checklists.length === 0 ? (
				<EmptyState
					title="No checklists yet."
					description="Create your first checklist to start tracking work."
				/>
			) : (
				<VStack gap={3}>
					<HStack gap={2} hAlign="between" vAlign="center">
						<Text type="label" weight="semibold">
							Your Checklists
						</Text>
						<OrderToggle
							isSorted={isBehindFirst}
							sortedLabel="Most behind first"
							defaultLabel="As added"
							onChange={setIsBehindFirst}
						/>
					</HStack>
					{ordered.map((checklist) => (
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
