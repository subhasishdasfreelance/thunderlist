import { IconButton } from "@astryxdesign/core/IconButton";
import { ArrowDownWideNarrow } from "lucide-react";

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
export function OrderToggle({
	isSorted,
	sortedLabel,
	defaultLabel,
	onChange,
}: {
	/** Whether the alternative order is in force. */
	isSorted: boolean;
	/** What the alternative order is, e.g. "Behind first". */
	sortedLabel: string;
	/** What the list reads as normally, e.g. "Newest first". */
	defaultLabel: string;
	onChange: (isSorted: boolean) => void;
}) {
	const current = isSorted ? sortedLabel : defaultLabel;
	const next = isSorted ? defaultLabel : sortedLabel;

	return (
		<IconButton
			label={`Sorted by ${current.toLowerCase()} — switch to ${next.toLowerCase()}`}
			tooltip={current}
			variant={isSorted ? "secondary" : "ghost"}
			size="sm"
			/*
			 * The same icon either way, struck through when it is off. Two
			 * different icons would say "these are two things"; one struck says
			 * "this thing, not applied", which is what the button actually means.
			 */
			icon={
				<span className="thunderlist-sort-icon" data-off={!isSorted}>
					<ArrowDownWideNarrow aria-hidden />
				</span>
			}
			onClick={() => onChange(!isSorted)}
		/>
	);
}
