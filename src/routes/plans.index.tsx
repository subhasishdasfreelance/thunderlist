import { Button } from "@astryxdesign/core/Button";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { LoadingState } from "#/components/common/loading-state";
import { ErrorNotice } from "#/components/common/states";
import { PlanFormDialog } from "#/components/plans/plan-form-dialog";
import { useApplyChange } from "#/lib/changes";
import { formatDate } from "#/lib/format-date";
import { createId, ID_PREFIX } from "#/lib/ids";
import { usePermissions } from "#/lib/use-team";
import { plansQuery } from "#/queries/plans";
import { primeQuery } from "#/queries/prime";
import type { PlanSummary } from "#/schemas/plan";

export const Route = createFileRoute("/plans/")({
	loader: ({ context }) => primeQuery(context.queryClient, plansQuery()),
	component: PlansPage,
});

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
 * the work they are about. A card each, most recently changed first; each
 * opens onto its own page to be read.
 */
function PlansPage() {
	const navigate = useNavigate();
	const { apply } = useApplyChange();
	const { canManageContent } = usePermissions();
	const [isCreating, setIsCreating] = useState(false);

	const { data, isPending, isError, error, refetch } = useQuery(plansQuery());
	const plans = data ?? [];

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
					<Text type="label" weight="semibold">
						{plans.length} {plans.length === 1 ? "plan" : "plans"}
					</Text>
					{plans.map((plan) => (
						<ClickableCard
							key={plan.planId}
							label={plan.title}
							href={`/plans/${plan.planId}`}
							padding={3}
						>
							<VStack gap={1}>
								<Text weight="medium" maxLines={1}>
									{plan.title}
								</Text>
								<Text type="supporting">
									Updated {formatDate(plan.updatedAt.slice(0, 10))} ·{" "}
									{sizeOf(plan)}
								</Text>
							</VStack>
						</ClickableCard>
					))}
				</VStack>
			)}

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
