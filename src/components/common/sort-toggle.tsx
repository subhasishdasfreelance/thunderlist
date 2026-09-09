import { IconButton } from "@astryxdesign/core/IconButton";
import { ArrowDownWideNarrow } from "lucide-react";
import { SORT_ORDER_LABELS, type SortOrder } from "#/lib/tasks/tasks";

/**
 * How a list is ordered.
 *
 * Two orders, so it is a switch rather than a menu: pressing it is one action
 * and the icon says which order is in force, where a menu would charge two
 * clicks to say the same thing.
 *
 * The choice lives on the screen rather than in the database. It is a way of
 * looking at a list, not a property of it, and the next person to open the app
 * should get the list back the way lists normally read.
 */
export function SortToggle({
	order,
	onChange,
}: {
	order: SortOrder;
	onChange: (order: SortOrder) => void;
}) {
	const isPriority = order === "priority";
	const next: SortOrder = isPriority ? "newest" : "priority";

	return (
		<IconButton
			label={`Sorted by ${SORT_ORDER_LABELS[order].toLowerCase()} — switch to ${SORT_ORDER_LABELS[next].toLowerCase()}`}
			tooltip={SORT_ORDER_LABELS[order]}
			variant={isPriority ? "secondary" : "ghost"}
			size="sm"
			/*
			 * The same icon either way, struck through when it is off. Two
			 * different icons would say "these are two things"; one struck says
			 * "this thing, not applied", which is what the button actually means.
			 */
			icon={
				<span className="thunderlist-sort-icon" data-off={!isPriority}>
					<ArrowDownWideNarrow aria-hidden />
				</span>
			}
			onClick={() => onChange(next)}
		/>
	);
}
