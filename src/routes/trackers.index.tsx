import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { StatGrid } from "#/components/common/stat-grid";
import { CardListSkeleton, ErrorNotice } from "#/components/common/states";
import { TrackerCard } from "#/components/trackers/tracker-card";
import { TrackerFormDialog } from "#/components/trackers/tracker-form-dialog";
import { queueCreateTracker, type TrackerValues } from "#/lib/pending/actions";
import { overlayTrackers } from "#/lib/pending/overlay-trackers";
import { usePendingChanges } from "#/lib/pending/store";
import { primeQuery } from "#/queries/prime";
import { trackersQuery } from "#/queries/trackers";

export const Route = createFileRoute("/trackers/")({
	loader: ({ context }) => primeQuery(context.queryClient, trackersQuery()),
	component: TrackersPage,
});

function TrackersPage() {
	const navigate = useNavigate();
	const [isFormOpen, setIsFormOpen] = useState(false);
	const queued = usePendingChanges();

	const { data, isPending, isError, error, refetch } = useQuery(
		trackersQuery(),
	);

	const trackers = useMemo(
		() => overlayTrackers(data ?? [], queued),
		[data, queued],
	);

	const totals = trackers.reduce(
		(sum, tracker) => ({
			percent: sum.percent + tracker.progress.percent,
			behind: sum.behind + (tracker.status === "behind" ? 1 : 0),
			done:
				sum.done +
				(tracker.progress.target > 0 &&
				tracker.progress.current >= tracker.progress.target
					? 1
					: 0),
			withDeadline: sum.withDeadline + (tracker.deadline === null ? 0 : 1),
		}),
		{ percent: 0, behind: 0, done: 0, withDeadline: 0 },
	);

	const stats = [
		{ label: "Trackers", value: `${trackers.length}` },
		{
			label: "Average progress",
			value:
				trackers.length === 0
					? "—"
					: `${Math.round(totals.percent / trackers.length)}%`,
		},
		{ label: "Finished", value: `${totals.done}` },
		{ label: "With a deadline", value: `${totals.withDeadline}` },
		{ label: "Behind", value: `${totals.behind}` },
	];

	function create(values: TrackerValues) {
		const trackerId = queueCreateTracker(values);
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

			{trackers.length === 0 || isPending ? null : <StatGrid stats={stats} />}

			{isError ? (
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			) : isPending ? (
				<CardListSkeleton />
			) : trackers.length === 0 ? (
				<EmptyState
					title="No trackers yet."
					description="Start tracking a book, course, goal, or anything measurable."
				/>
			) : (
				<VStack gap={3}>
					<Text type="label" weight="semibold">
						Your Trackers
					</Text>
					{trackers.map((tracker) => (
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
