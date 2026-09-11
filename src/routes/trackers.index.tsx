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
	createTagResolver,
	createTracker,
	type TrackerValues,
	useApplyChange,
} from "#/lib/changes";
import { lagFraction } from "#/lib/progress";
import { useNow } from "#/lib/use-now";
import { deferQuery, primeQuery } from "#/queries/prime";
import { tagsQuery } from "#/queries/tags";
import { trackersQuery } from "#/queries/trackers";
import type { TrackerSummary } from "#/schemas/tracker";

/**
 * How far behind a tracker is, worst first.
 *
 * The same measure the pace label on the card is drawn from, so the order
 * agrees with what each card says about itself.
 */
function lag(tracker: TrackerSummary, now: number): number {
	return lagFraction({
		startDate: tracker.startDate,
		deadline: tracker.deadline,
		deadlineTime: tracker.deadlineTime,
		now,
		fractionComplete: tracker.progress.percent / 100,
	});
}

export const Route = createFileRoute("/trackers/")({
	loader: ({ context }) => {
		// The tags on each card, and for the form; the trackers are the screen.
		deferQuery(context.queryClient, tagsQuery());

		return primeQuery(context.queryClient, trackersQuery());
	},
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
	const tagsResult = useQuery(tagsQuery());

	const trackers = data ?? [];
	const tags = tagsResult.data ?? [];

	/*
	 * Behind first, or the order they were made in.
	 *
	 * A page of totals answered "how is all of this going" with one number that
	 * was true of nothing in particular — an average across a book and a fitness
	 * goal means nothing. The useful version of that question is "which of these
	 * needs me", and that is an ordering of the cards rather than a row of
	 * figures above them.
	 */
	// Judged on the viewer's clock, so sorted only once the browser has it.
	const now = useNow();
	const ordered =
		isBehindFirst && now !== null
			? [...trackers].sort((a, b) => lag(b, now) - lag(a, now))
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
						<TrackerCard
							key={tracker.trackerId}
							tracker={tracker}
							tags={tags}
						/>
					))}
				</VStack>
			)}

			<TrackerFormDialog
				isOpen={isFormOpen}
				onOpenChange={setIsFormOpen}
				tags={tags}
				resolveTags={(names) => names.map(createTagResolver(apply, tags))}
				onSubmit={create}
			/>
		</VStack>
	);
}
