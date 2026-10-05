import { Button } from "@astryxdesign/core/Button";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { ArrangeDialog } from "#/components/common/arrange-dialog";
import {
	ArrangeButton,
	SelectButtons,
	saveArrangement,
} from "#/components/common/arranged-list";
import { LoadingState } from "#/components/common/loading-state";
import { Pickable } from "#/components/common/pickable";
import { PickedItemsBar } from "#/components/common/picked-items-bar";
import { ErrorNotice } from "#/components/common/states";
import { PlanFormDialog } from "#/components/plans/plan-form-dialog";
import { useApplyChange } from "#/lib/changes";
import { formatDate } from "#/lib/format-date";
import { createId, ID_PREFIX } from "#/lib/ids";
import { useNow } from "#/lib/use-now";
import { usePickMode } from "#/lib/use-pick-mode";
import { usePermissions } from "#/lib/use-team";
import { plansQuery } from "#/queries/plans";
import { primeQuery } from "#/queries/prime";
import { arrangementsQuery } from "#/queries/space";
import { EMPTY_ARRANGEMENT, manualOrder } from "#/schemas/arrangement";
import { todayDateOnly } from "#/schemas/common";
import type { PlanSummary } from "#/schemas/plan";

export const Route = createFileRoute("/plans/")({
	// The order is the space's, and read with the list, so it is drawn in it
	// from the start rather than rearranged after.
	loader: ({ context }) =>
		Promise.all([
			primeQuery(context.queryClient, plansQuery()),
			primeQuery(context.queryClient, arrangementsQuery()),
		]).then(() => undefined),
	component: PlansPage,
});

const planIdOf = (plan: PlanSummary) => plan.planId;

/** How long a plan is, roughly: "12 KB". */
function sizeOf(plan: PlanSummary): string {
	if (plan.length === 0) return "Empty";
	const kb = plan.length / 1024;
	return kb < 1
		? `${plan.length} characters`
		: `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
}

/**
 * Plans: long Markdown documents — a roadmap, a design, a spec — kept beside
 * the work they are about. A card each, in the order arranged by hand — any
 * not placed yet after those, most recently changed first; each opens onto
 * its own page to be read.
 */
function PlansPage() {
	const navigate = useNavigate();
	const { apply } = useApplyChange();
	const { canManageContent } = usePermissions();
	// Several picked out, to change together; see `usePickMode`.
	const pick = usePickMode(canManageContent);
	const [isCreating, setIsCreating] = useState(false);
	const [isArranging, setIsArranging] = useState(false);

	const { data, isPending, isError, error, refetch } = useQuery(plansQuery());
	const arrangement =
		useQuery(arrangementsQuery()).data?.plans ?? EMPTY_ARRANGEMENT;
	const plans = useMemo(
		() => manualOrder(data ?? [], planIdOf, arrangement.order),
		[data, arrangement.order],
	);
	// The day on the viewer's clock, once the browser has it; see `useNow`.
	const now = useNow();
	const dayOf = (at: string) =>
		formatDate(now === null ? at.slice(0, 10) : todayDateOnly(new Date(at)));

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<Heading level={1}>Plans</Heading>
				{canManageContent ? (
					<Button
						label="New plan"
						variant="primary"
						icon={<Plus aria-hidden />}
						onClick={() => setIsCreating(true)}
					/>
				) : null}
			</HStack>

			{isError ? (
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			) : isPending ? (
				<LoadingState />
			) : plans.length === 0 ? (
				<EmptyState
					title="No plans yet."
					description="Write one here, or bring in a .md file from New plan."
				/>
			) : (
				<VStack gap={3}>
					<HStack gap={2} hAlign="between" vAlign="center">
						<Text type="label" weight="semibold">
							{plans.length} {plans.length === 1 ? "plan" : "plans"}
						</Text>
						{canManageContent ? (
							<HStack gap={1} vAlign="center">
								<SelectButtons mode={pick} />
								<ArrangeButton onClick={() => setIsArranging(true)} />
							</HStack>
						) : null}
					</HStack>
					<div className="thunderlist-card-grid">
						{plans.map((plan) => (
							<Pickable
								key={plan.planId}
								id={plan.planId}
								isPicking={pick.isPicking}
								isPicked={pick.picked.has(plan.planId)}
								label={plan.title}
								onToggle={() => pick.toggle(plan.planId)}
							>
								<ClickableCard
									label={plan.title}
									href={`/plans/${plan.planId}`}
									padding={3}
								>
									<VStack gap={1}>
										<Text weight="medium" maxLines={1}>
											{plan.title}
										</Text>
										<Text type="supporting">
											Updated {dayOf(plan.updatedAt)} · {sizeOf(plan)}
										</Text>
									</VStack>
								</ClickableCard>
							</Pickable>
						))}
					</div>
				</VStack>
			)}

			{pick.isPicking ? (
				<PickedItemsBar
					of="plan"
					items={plans.flatMap((plan) =>
						pick.picked.has(plan.planId) ? [{ id: plan.planId }] : [],
					)}
					onDone={pick.stop}
				/>
			) : null}

			<ArrangeDialog
				isOpen={isArranging}
				onOpenChange={setIsArranging}
				noun="plans"
				items={plans.map((plan) => ({ id: plan.planId, label: plan.title }))}
				arrangement={arrangement}
				onSave={(next) => {
					saveArrangement(apply, "plans", next);
					setIsArranging(false);
				}}
			/>

			<PlanFormDialog
				isOpen={isCreating}
				onOpenChange={setIsCreating}
				onSubmit={(values) => {
					const planId = createId(ID_PREFIX.plan);
					apply({ kind: "plan.create", planId, ...values });
					setIsCreating(false);
					// Drawn already, so its page opens straight onto it.
					void navigate({ to: "/plans/$planId", params: { planId } });
				}}
			/>
		</VStack>
	);
}
