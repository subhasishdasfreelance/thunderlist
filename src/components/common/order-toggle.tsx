import { IconButton } from "@astryxdesign/core/IconButton";
import { ArrowDownWideNarrow, type LucideIcon } from "lucide-react";

/**
 * How a list is ordered.
 *
 * Two orders, so it is a switch rather than a menu: pressing it is one action
 * and the button says which order is in force, where a menu would charge two
 * clicks to say the same thing.
 *
 * The choice lives on the screen rather than in the database. It is a way of
 * looking at a list, not a property of it, and the next person to open the app
 * should get the list back the way lists normally read.
 */
export function OrderToggle({
	isSorted,
	sortedLabel,
	defaultLabel,
	icon: Mark = ArrowDownWideNarrow,
	onChange,
}: {
	/** Whether the alternative order is in force. */
	isSorted: boolean;
	/** What the alternative order is, e.g. "Behind first". */
	sortedLabel: string;
	/** What the list reads as normally, e.g. "Newest first". */
	defaultLabel: string;
	/** What the alternative order is by, where a list has more than one. */
	icon?: LucideIcon;
	onChange: (isSorted: boolean) => void;
}) {
	const current = isSorted ? sortedLabel : defaultLabel;
	const next = isSorted ? defaultLabel : sortedLabel;

	return (
		/*
		 * Quiet while off and lit in the accent while on, the way a task's flags
		 * are lit, so which order is in force reads from across the screen; see
		 * `.thunderlist-order`.
		 */
		<span className="thunderlist-order" data-on={isSorted}>
			<IconButton
				label={`Sorted by ${current.toLowerCase()} — switch to ${next.toLowerCase()}`}
				tooltip={current}
				variant="ghost"
				size="sm"
				icon={<Mark aria-hidden />}
				onClick={() => onChange(!isSorted)}
			/>
		</span>
	);
}
