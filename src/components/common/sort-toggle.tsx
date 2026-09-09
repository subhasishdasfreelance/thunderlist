import { SORT_ORDER_LABELS, type SortOrder } from "#/lib/tasks/tasks";
import { OrderToggle } from "./order-toggle";

/** A task list's order: the hand-made one, or urgent and important first. */
export function SortToggle({
	order,
	onChange,
}: {
	order: SortOrder;
	onChange: (order: SortOrder) => void;
}) {
	return (
		<OrderToggle
			isSorted={order === "priority"}
			sortedLabel={SORT_ORDER_LABELS.priority}
			defaultLabel={SORT_ORDER_LABELS.newest}
			onChange={(isSorted) => onChange(isSorted ? "priority" : "newest")}
		/>
	);
}
