import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { LoadingState } from "#/components/common/loading-state";
import { OrderToggle } from "#/components/common/order-toggle";
import { ErrorNotice } from "#/components/common/states";
import { TrackerCard } from "#/components/trackers/tracker-card";
import { TrackerFormDialog } from "#/components/trackers/tracker-form-dialog";
import {
	createTracker,
	type TrackerValues,
	useApplyChange,
} from "#/lib/changes";
import { lagFraction } from "#/lib/progress";
import { primeQuery } from "#/queries/prime";
import { trackersQuery } from "#/queries/trackers";
import type { TrackerSummary } from "#/schemas/tracker";

/**
 * How far behind a tracker is, worst first.
 *
 * The same measure the pace label on the card is drawn from, so the order
 * agrees with what each card says about itself.
 */
function lag(tracker: TrackerSummary): number {
	return lagFraction({
		startDate: tracker.startDate,
		deadline: tracker.deadline,
		fractionComplete: tracker.progress.percent / 100,
	});
}

export const Route = createFileRoute("/trackers/")({
	loader: ({ context }) => primeQuery(context.queryClient, trackersQuery()),
	component: TrackersPage,
});

function TrackersPage() {
	const navigate = useNavigate();
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [isBehindFirst, setIsBehindFirst] = useState(false);
	const { apply } = useApplyChange();

	const { data, isPending, isError, error, refetch } = useQuery(
		trackersQuery(),
	);

	const trackers = data ?? [];

	/*
	 * Behind first, or the order they were made in.
	 *
	 * A page of totals answered "how is all of this going" with one number that
	 * was true of nothing in particular — an average across a book and a fitness
	 * goal means nothing. The useful version of that question is "which of these
	 * needs me", and that is an ordering of the cards rather than a row of
	 * figures above them.
	 */
	const ordered = isBehindFirst
		? [...trackers].sort((a, b) => lag(b) - lag(a))
		: trackers;

	function create(values: TrackerValues) {
		const trackerId = createTracker(apply, values);
		setIsFormOpen(false);
		void navigate({ to: "/trackers/$trackerId", params: { trackerId } });
	}

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<Heading level={1}>Trackers</Heading>
				<Button
					label="New tracker"
					variant="primary"
					icon={<Plus aria-hidden />}
					onClick={() => setIsFormOpen(true)}
				/>
			</HStack>

			{isError ? (
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			) : isPending ? (
				<LoadingState />
			) : trackers.length === 0 ? (
				<EmptyState
					title="No trackers yet."
					description="Start tracking a book, course, goal, or anything measurable."
				/>
			) : (
				<VStack gap={3}>
					<HStack gap={2} hAlign="between" vAlign="center">
						<Text type="label" weight="semibold">
							Your Trackers
						</Text>
						<OrderToggle
							isSorted={isBehindFirst}
							sortedLabel="Most behind first"
							defaultLabel="As added"
							onChange={setIsBehindFirst}
						/>
					</HStack>
					{ordered.map((tracker) => (
						<TrackerCard key={tracker.trackerId} tracker={tracker} />
					))}
				</VStack>
			)}

			<TrackerFormDialog
				isOpen={isFormOpen}
				onOpenChange={setIsFormOpen}
				onSubmit={create}
			/>
		</VStack>
	);
}
