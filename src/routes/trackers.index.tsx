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
	ArrangedCards,
	ListOrderMenu,
	SelectButtons,
	saveArrangement,
	useArrangedList,
} from "#/components/common/arranged-list";
import { editableTracker } from "#/components/common/items-edit-dialog";
import { LoadingState } from "#/components/common/loading-state";
import { PickedItemsBar } from "#/components/common/picked-items-bar";
import { ErrorNotice } from "#/components/common/states";
import { MemberFilter } from "#/components/teams/member-filter";
import { TrackerCard } from "#/components/trackers/tracker-card";
import { TrackerFormDialog } from "#/components/trackers/tracker-form-dialog";
import { trackersBehind } from "#/lib/behind";
import {
	createTracker,
	resolveTags,
	type TrackerValues,
	useApplyChange,
	withNewTags,
} from "#/lib/changes";
import { searchText } from "#/lib/filter-search";
import { isAssignedTo } from "#/lib/tasks/tasks";
import { useNow } from "#/lib/use-now";
import { usePickMode } from "#/lib/use-pick-mode";
import { usePermissions } from "#/lib/use-team";
import { deferQuery, primeQuery } from "#/queries/prime";
import { arrangementsQuery, groupsQuery } from "#/queries/space";
import { tagsQuery } from "#/queries/tags";
import { trackerQuery, trackersQuery } from "#/queries/trackers";
import { manualOrder } from "#/schemas/arrangement";
import { groupedIds } from "#/schemas/group";
import type { TrackerSummary } from "#/schemas/tracker";

const trackerIdOf = (tracker: TrackerSummary) => tracker.trackerId;
const createdAtOf = (tracker: TrackerSummary) => tracker.createdAt;
const titleOf = (tracker: TrackerSummary) => tracker.title;

export const Route = createFileRoute("/trackers/")({
	// The person the list is narrowed to, kept in the address; see
	// `filterSearch`.
	validateSearch: (search: Record<string, unknown>): { who?: string } => ({
		who: searchText(search.who),
	}),
	loader: ({ context }) => {
		// The tags on each card, and for the form; the trackers are the screen.
		deferQuery(context.queryClient, tagsQuery());

		// The order is the space's, and read with the list, so it
		// is drawn in them from the start rather than rearranged after.
		return Promise.all([
			primeQuery(context.queryClient, trackersQuery()),
			primeQuery(context.queryClient, arrangementsQuery()),
			// Which are in a group, and left to it.
			primeQuery(context.queryClient, groupsQuery()),
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
	const { who: assignee } = Route.useSearch();
	const setAssignee = (who: string | undefined) =>
		void navigate({
			to: ".",
			search: { who },
			replace: true,
			resetScroll: false,
		});
	const { apply, applyAsync } = useApplyChange();
	const { canManageContent } = usePermissions();
	// Several picked out, to change together; see `usePickMode`.
	const pick = usePickMode(canManageContent);

	const { data, isPending, isError, error, refetch } = useQuery(
		trackersQuery(),
	);
	const tagsResult = useQuery(tagsQuery());
	const groups = useQuery(groupsQuery()).data;

	const allTrackers = data ?? [];
	// Only those in no group; one in a group is listed on its page.
	const ungrouped = useMemo(() => {
		const grouped = groupedIds(groups ?? [], "tracker");
		return (data ?? []).filter((each) => !grouped.has(each.trackerId));
	}, [data, groups]);
	const trackers = ungrouped.filter((tracker) =>
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
	// Your order, newest first or most behind first; see `useArrangedList`. Behind is judged on the viewer's clock, so only once
	// the browser has it.
	const now = useNow();
	const behind = useMemo(
		() => (now === null ? null : trackersBehind(now)),
		[now],
	);
	const arranged = useArrangedList({
		list: "trackers",
		items: trackers,
		idOf: trackerIdOf,
		createdAt: createdAtOf,
		nameOf: titleOf,
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

		// The form closes at once and the loading screen stands in while the
		// server writes it, rather than the form waiting on the answer.
		setIsFormOpen(false);
		setIsOpening(true);
		try {
			const trackerId = await createTracker(applyAsync, values);

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
			// Already reported by `useApplyChange`; back to the list it was not
			// added to.
			setIsOpening(false);
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
								<>
									<SelectButtons mode={pick} />
									<ArrangeButton onClick={() => setIsArranging(true)} />
								</>
							) : null}
						</HStack>
					</HStack>
					{trackers.length === 0 ? (
						<EmptyState
							isCompact
							title="Nothing here."
							description={
								assignee === undefined
									? "Every tracker is in a group."
									: "No tracker is assigned to them."
							}
						/>
					) : null}
					<ArrangedCards
						items={arranged.ordered}
						idOf={trackerIdOf}
						render={(tracker) => <TrackerCard tracker={tracker} tags={tags} />}
						pick={{ mode: pick, labelOf: (tracker) => tracker.title }}
					/>
				</VStack>
			)}

			{pick.isPicking ? (
				<PickedItemsBar
					of="tracker"
					items={allTrackers.flatMap((tracker) =>
						pick.picked.has(tracker.trackerId)
							? [
									{
										id: tracker.trackerId,
										access: tracker.access,
										editable: editableTracker(tracker),
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
				noun="trackers"
				items={manualOrder(
					ungrouped,
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
					withNewTags(apply, tags, canManageContent, (resolve) =>
						resolveTags(resolve, names),
					)
				}
				isSaving={isCreating}
				onSubmit={(values) => void create(values)}
			/>
		</VStack>
	);
}
