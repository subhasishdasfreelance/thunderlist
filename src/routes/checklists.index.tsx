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
	createTagResolver,
	useApplyChange,
} from "#/lib/changes";
import { compareBehind } from "#/lib/progress";
import { useNow } from "#/lib/use-now";
import { checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { tagsQuery } from "#/queries/tags";
import type { ChecklistSummary } from "#/schemas/checklist";

/**
 * Where a checklist stands against its schedule, for ordering the most behind
 * first; see `compareBehind`.
 *
 * The same measure the pace label on the card is drawn from, so the order
 * agrees with what each card says about itself.
 */
function standing(checklist: ChecklistSummary, now: number) {
	return {
		startDate: checklist.startDate,
		deadline: checklist.deadline,
		deadlineTime: checklist.deadlineTime,
		dailyWindow: checklist.dailyWindow,
		now,
		fractionComplete: checklist.progress.percent / 100,
	};
}

export const Route = createFileRoute("/checklists/")({
	loader: ({ context }) => {
		// Only the new-checklist form needs the tags, and not on the first frame.
		deferQuery(context.queryClient, tagsQuery());

		return primeQuery(context.queryClient, checklistsQuery());
	},
	component: ChecklistsPage,
});

function ChecklistsPage() {
	const navigate = useNavigate();
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [isBehindFirst, setIsBehindFirst] = useState(false);
	const { apply, applyAsync } = useApplyChange();

	const { data, isPending, isError, error, refetch } = useQuery(
		checklistsQuery(),
	);
	const tagsResult = useQuery(tagsQuery());

	const checklists = data ?? [];
	const tags = tagsResult.data ?? [];

	/*
	 * Behind first, or the order they were made in.
	 *
	 * A page of totals answered "how is all of this going" with one number that
	 * was true of nothing in particular. The useful version of that question is
	 * "which of these needs me", and that is an ordering of the cards already on
	 * the screen rather than a row of figures above them.
	 */
	// Judged on the viewer's clock, so sorted only once the browser has it.
	const now = useNow();
	const ordered =
		isBehindFirst && now !== null
			? [...checklists].sort((a, b) =>
					compareBehind(standing(a, now), standing(b, now)),
				)
			: checklists;

	/*
	 * Into the new checklist so tasks can be added — but only once the server
	 * has it. Going in sooner had the new screen ask for a checklist that did
	 * not exist yet, which it could show as an error.
	 */
	async function create(values: ChecklistValues) {
		if (isCreating) return;
		setIsCreating(true);

		try {
			const checklistId = await createChecklist(applyAsync, values);
			setIsFormOpen(false);
			void navigate({
				to: "/checklists/$checklistId",
				params: { checklistId },
				search: { task: undefined },
			});
		} catch {
			// Already reported by `useApplyChange`; the form stays open to retry.
		} finally {
			setIsCreating(false);
		}
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
							{checklists.length}{" "}
							{checklists.length === 1 ? "checklist" : "checklists"}
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
				tags={tags}
				resolveTags={(names) => names.map(createTagResolver(apply, tags))}
				isSaving={isCreating}
				onSubmit={(values) => void create(values)}
			/>
		</VStack>
	);
}
