import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ArrangeDialog } from "#/components/common/arrange-dialog";
import {
	ArrangeButton,
	ArrangedSections,
	ListOrderMenu,
	saveArrangement,
	useArrangedList,
} from "#/components/common/arranged-list";
import { LoadingState } from "#/components/common/loading-state";
import { ErrorNotice } from "#/components/common/states";
import { MemberFilter } from "#/components/teams/member-filter";
import { TrackerCard } from "#/components/trackers/tracker-card";
import { TrackerFormDialog } from "#/components/trackers/tracker-form-dialog";
import {
	createTagResolver,
	createTracker,
	resolveTags,
	type TrackerValues,
	useApplyChange,
} from "#/lib/changes";
import { lagFraction } from "#/lib/progress";
import { isAssignedTo } from "#/lib/tasks/tasks";
import { useNow } from "#/lib/use-now";
import { usePermissions } from "#/lib/use-team";
import { deferQuery, primeQuery } from "#/queries/prime";
import { arrangementsQuery } from "#/queries/space";
import { tagsQuery } from "#/queries/tags";
import { trackerQuery, trackersQuery } from "#/queries/trackers";
import { manualOrder } from "#/schemas/arrangement";
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

const trackerIdOf = (tracker: TrackerSummary) => tracker.trackerId;
const createdAtOf = (tracker: TrackerSummary) => tracker.createdAt;

export const Route = createFileRoute("/trackers/")({
	loader: ({ context }) => {
		// The tags on each card, and for the form; the trackers are the screen.
		deferQuery(context.queryClient, tagsQuery());

		// The order and groups are the space's, and read with the list, so it
		// is drawn in them from the start rather than rearranged after.
		return Promise.all([
			primeQuery(context.queryClient, trackersQuery()),
			primeQuery(context.queryClient, arrangementsQuery()),
		]).then(() => undefined);
	},
	component: TrackersPage,
});

function TrackersPage() {
	const navigate = useNavigate();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [isOpening, setIsOpening] = useState(false);
	const [isArranging, setIsArranging] = useState(false);
	// In a team, one person's trackers rather than everyone's; see `MemberFilter`.
	const [assignee, setAssignee] = useState<string | undefined>(undefined);
	const { apply, applyAsync } = useApplyChange();
	const { canManageContent } = usePermissions();

	const { data, isPending, isError, error, refetch } = useQuery(
		trackersQuery(),
	);
	const tagsResult = useQuery(tagsQuery());

	const allTrackers = data ?? [];
	const trackers = allTrackers.filter((tracker) =>
		isAssignedTo(tracker, assignee),
	);
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
	// Your order, newest first or most behind first, and in your groups; see
	// `useArrangedList`. Behind is judged on the viewer's clock, so only once
	// the browser has it.
	const now = useNow();
	const behind = useMemo(
		() =>
			now === null
				? null
				: (a: TrackerSummary, b: TrackerSummary) => lag(b, now) - lag(a, now),
		[now],
	);
	const arranged = useArrangedList({
		list: "trackers",
		items: trackers,
		idOf: trackerIdOf,
		createdAt: createdAtOf,
		compareBehind: behind,
	});

	/*
	 * Into the new tracker once the server has it and its screen is ready to
	 * draw, not before; see the same on the Checklists screen. The loading
	 * screen stands in between.
	 */
	async function create(values: TrackerValues) {
		if (isCreating) return;
		setIsCreating(true);

		try {
			const trackerId = await createTracker(applyAsync, values);
			setIsFormOpen(false);
			setIsOpening(true);

			const destination = {
				to: "/trackers/$trackerId",
				params: { trackerId },
			} as const;
			await Promise.all([
				router.preloadRoute(destination).catch(() => undefined),
				queryClient.prefetchQuery(trackerQuery(trackerId)),
			]);
			void navigate(destination);
		} catch {
			// Already reported by `useApplyChange`; the form stays open to retry.
		} finally {
			setIsCreating(false);
		}
	}

	if (isOpening) return <LoadingState label="Opening your new tracker…" />;

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<Heading level={1}>Trackers</Heading>
				{canManageContent ? (
					<Button
						label="New tracker"
						variant="primary"
						icon={<Plus aria-hidden />}
						onClick={() => setIsFormOpen(true)}
					/>
				) : null}
			</HStack>

			{isError ? (
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			) : isPending ? (
				<LoadingState />
			) : allTrackers.length === 0 ? (
				<EmptyState
					title="No trackers yet."
					description="Start tracking a book, course, goal, or anything measurable."
				/>
			) : (
				<VStack gap={3}>
					<HStack gap={2} hAlign="between" vAlign="center">
						<Text type="label" weight="semibold">
							{trackers.length} {trackers.length === 1 ? "tracker" : "trackers"}
						</Text>
						<HStack gap={1} vAlign="center">
							<MemberFilter value={assignee} onChange={setAssignee} />
							<ListOrderMenu
								order={arranged.order}
								onChange={arranged.setOrder}
							/>
							{canManageContent ? (
								<ArrangeButton onClick={() => setIsArranging(true)} />
							) : null}
						</HStack>
					</HStack>
					{trackers.length === 0 ? (
						<EmptyState
							isCompact
							title="Nothing here."
							description="No tracker is assigned to them."
						/>
					) : null}
					<ArrangedSections
						sections={arranged.sections}
						idOf={trackerIdOf}
						render={(tracker) => <TrackerCard tracker={tracker} tags={tags} />}
					/>
				</VStack>
			)}

			<ArrangeDialog
				isOpen={isArranging}
				onOpenChange={setIsArranging}
				noun="trackers"
				items={manualOrder(
					allTrackers,
					trackerIdOf,
					arranged.arrangement.order,
				).map((tracker) => ({ id: tracker.trackerId, label: tracker.title }))}
				arrangement={arranged.arrangement}
				onSave={(next) => {
					saveArrangement(apply, "trackers", next);
					setIsArranging(false);
				}}
			/>

			<TrackerFormDialog
				isOpen={isFormOpen}
				onOpenChange={setIsFormOpen}
				tags={tags}
				resolveTags={(names) =>
					resolveTags(createTagResolver(apply, tags, canManageContent), names)
				}
				isSaving={isCreating}
				onSubmit={(values) => void create(values)}
			/>
		</VStack>
	);
}
