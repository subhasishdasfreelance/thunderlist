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
import { ChecklistCard } from "#/components/checklists/checklist-card";
import { ChecklistFormDialog } from "#/components/checklists/checklist-form-dialog";
import { ArrangeDialog } from "#/components/common/arrange-dialog";
import {
	ArrangeButton,
	ArrangedCards,
	ListOrderMenu,
	SelectButtons,
	saveArrangement,
	useArrangedList,
} from "#/components/common/arranged-list";
import { editableChecklist } from "#/components/common/items-edit-dialog";
import { ListPanel } from "#/components/common/list-panel";
import { LoadingState } from "#/components/common/loading-state";
import { PickedItemsBar } from "#/components/common/picked-items-bar";
import { ErrorNotice } from "#/components/common/states";
import { checklistsBehind } from "#/lib/behind";
import {
	type ChecklistValues,
	createChecklist,
	resolveTags,
	useApplyChange,
	withNewTags,
} from "#/lib/changes";
import { useNow } from "#/lib/use-now";
import { firstPage } from "#/lib/use-pages";
import { usePickMode } from "#/lib/use-pick-mode";
import { usePermissions } from "#/lib/use-team";
import { checklistPageQuery, checklistsQuery } from "#/queries/checklists";
import { deferQuery, primeQuery } from "#/queries/prime";
import { arrangementsQuery, groupsQuery } from "#/queries/space";
import { tagsQuery } from "#/queries/tags";
import type { ChecklistSummary } from "#/schemas/checklist";
import { groupedIds } from "#/schemas/group";

const checklistIdOf = (checklist: ChecklistSummary) => checklist.checklistId;
const createdAtOf = (checklist: ChecklistSummary) => checklist.createdAt;
const titleOf = (checklist: ChecklistSummary) => checklist.title;

export const Route = createFileRoute("/checklists/")({
	loader: ({ context }) => {
		// Only the new-checklist form needs the tags, and not on the first frame.
		deferQuery(context.queryClient, tagsQuery());

		// The order is the space's, and read with the list, so it
		// is drawn in them from the start rather than rearranged after.
		return Promise.all([
			primeQuery(context.queryClient, checklistsQuery()),
			primeQuery(context.queryClient, arrangementsQuery()),
			// Which are in a group, and left to it.
			primeQuery(context.queryClient, groupsQuery()),
		]).then(() => undefined);
	},
	component: ChecklistsPage,
});

function ChecklistsPage() {
	const navigate = useNavigate();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [isOpening, setIsOpening] = useState(false);
	const [isArranging, setIsArranging] = useState(false);
	const { apply, applyAsync } = useApplyChange();
	const { canManageContent } = usePermissions();
	// Several picked out, to delete, group or share together; see `usePickMode`.
	const pick = usePickMode(canManageContent);

	const { data, isPending, isError, error, refetch } = useQuery(
		checklistsQuery(),
	);
	const tagsResult = useQuery(tagsQuery());
	const groups = useQuery(groupsQuery()).data;

	const allChecklists = data ?? [];
	// Only those in no group; one in a group is listed on its page.
	const checklists = useMemo(() => {
		const grouped = groupedIds(groups ?? [], "checklist");
		return (data ?? []).filter((each) => !grouped.has(each.checklistId));
	}, [data, groups]);
	const tags = tagsResult.data ?? [];

	/*
	 * In your own order, newest first, or most behind first; see
	 * `useArrangedList`.
	 *
	 * A page of totals answered "how is all of this going" with one number that
	 * was true of nothing in particular. The useful version of that question is
	 * "which of these needs me", and that is an ordering of the cards already on
	 * the screen rather than a row of figures above them.
	 */
	// Judged on the viewer's clock, so sorted only once the browser has it.
	const now = useNow();
	const arranged = useArrangedList({
		list: "checklists",
		items: checklists,
		idOf: checklistIdOf,
		createdAt: createdAtOf,
		nameOf: titleOf,
		compareBehind: useMemo(
			() => (now === null ? null : checklistsBehind(now)),
			[now],
		),
	});

	/*
	 * Into the new checklist so tasks can be added — but only once the server
	 * has it, and only once its screen is ready to draw. Going in sooner had the
	 * new screen ask for a checklist that did not exist yet, or fetch its own
	 * code on arrival — after a deploy, from a server that no longer has it —
	 * and either could show as an error. The loading screen stands in between.
	 */
	async function create(values: ChecklistValues) {
		if (isCreating) return;
		setIsCreating(true);

		// The form closes at once and the loading screen stands in while the
		// server writes it, rather than the form waiting on the answer.
		setIsFormOpen(false);
		setIsOpening(true);
		try {
			const checklistId = await createChecklist(applyAsync, values);

			const destination = {
				to: "/checklists/$checklistId",
				params: { checklistId },
				search: { task: undefined },
			} as const;
			// Its code and its first page of tasks. Anything that still fails is
			// the new screen's to deal with, and it does.
			await Promise.all([
				router.preloadRoute(destination).catch(() => undefined),
				queryClient.prefetchQuery(checklistPageQuery(checklistId, firstPage())),
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

	if (isOpening) return <LoadingState label="Opening your new checklist…" />;

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<Heading level={1}>Checklists</Heading>
				{canManageContent ? (
					<Button
						label="New checklist"
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
			) : allChecklists.length === 0 ? (
				<EmptyState
					title="No checklists yet."
					description="Create your first checklist to start tracking work."
				/>
			) : (
				<VStack gap={3}>
					<ListPanel
						controls={
							<HStack gap={2} hAlign="between" vAlign="center">
								<Text type="label" weight="semibold" color="secondary">
									{checklists.length}{" "}
									{checklists.length === 1 ? "checklist" : "checklists"}
								</Text>
								<HStack gap={1} vAlign="center">
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
						}
					/>
					{checklists.length === 0 ? (
						<EmptyState
							isCompact
							title="Nothing here."
							description="Every checklist is in a group."
						/>
					) : null}
					<ArrangedCards
						items={arranged.ordered}
						idOf={checklistIdOf}
						render={(checklist) => <ChecklistCard checklist={checklist} />}
						pick={{
							mode: pick,
							labelOf: (checklist) => checklist.title,
							// The Inbox and the Backlog are everyone's, and stay.
							isPickable: (checklist) => checklist.special == null,
						}}
					/>
				</VStack>
			)}

			{pick.isPicking ? (
				<PickedItemsBar
					of="checklist"
					items={checklists.flatMap((checklist) =>
						pick.picked.has(checklist.checklistId)
							? [
									{
										id: checklist.checklistId,
										access: checklist.access,
										editable: editableChecklist(checklist),
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
				noun="checklists"
				items={arranged.byHand.map((checklist) => ({
					id: checklist.checklistId,
					label: checklist.title,
				}))}
				arrangement={arranged.arrangement}
				onSave={(next) => {
					saveArrangement(apply, "checklists", next);
					setIsArranging(false);
				}}
			/>

			<ChecklistFormDialog
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
