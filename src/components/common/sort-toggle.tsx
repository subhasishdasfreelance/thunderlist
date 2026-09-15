import { HStack } from "@astryxdesign/core/Stack";
import { ChartNoAxesGantt, Flame } from "lucide-react";
import { SORT_ORDER_LABELS, type SortOrder } from "#/lib/tasks/tasks";
import { OrderToggle } from "./order-toggle";

/**
 * A task list's order: the hand-made one, urgent and important first — the
 * flame — or, where the list mixes tasks at different stages, the ones still
 * to do first and the nearly done last — the steps of a plan. One switch
 * each, side by side; turning one on turns the other off.
 */
export function SortToggle({
	order,
	onChange,
	hasStageOrder = false,
}: {
	order: SortOrder;
	onChange: (order: SortOrder) => void;
	/**
	 * Offer ordering by stage. Only where rows can be at different stages — a
	 * tag's page; a checklist shows one stage at a time.
	 */
	hasStageOrder?: boolean;
}) {
	/** What the list goes back to, or is, with this switch off. */
	const otherwise = (own: SortOrder) =>
		SORT_ORDER_LABELS[order === own ? "newest" : order];

	return (
		<HStack gap={0.5} vAlign="center">
			<OrderToggle
				icon={Flame}
				isSorted={order === "priority"}
				sortedLabel={SORT_ORDER_LABELS.priority}
				defaultLabel={otherwise("priority")}
				onChange={(isSorted) => onChange(isSorted ? "priority" : "newest")}
			/>
			{hasStageOrder ? (
				<OrderToggle
					icon={ChartNoAxesGantt}
					isSorted={order === "stage"}
					sortedLabel={SORT_ORDER_LABELS.stage}
					defaultLabel={otherwise("stage")}
					onChange={(isSorted) => onChange(isSorted ? "stage" : "newest")}
				/>
			) : null}
		</HStack>
	);
}
