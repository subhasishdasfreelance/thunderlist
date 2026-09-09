import {
	SegmentedControl,
	SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { ChartLine, List } from "lucide-react";

export type ProgressView = "list" | "chart";

/**
 * List or graph, for the same history.
 *
 * The two answer different questions — the list says what happened on a given
 * day, the graph says whether the shape of it will get there in time — and
 * neither is the obvious default for everyone, so it is a switch rather than a
 * choice made here.
 *
 * Icons only: it sits in a section heading beside a title, where two words
 * would compete with it.
 */
export function ViewToggle({
	view,
	onChange,
	label,
}: {
	view: ProgressView;
	onChange: (view: ProgressView) => void;
	/** Names what is being switched, for anyone who cannot see the two icons. */
	label: string;
}) {
	return (
		<SegmentedControl
			label={label}
			size="sm"
			value={view}
			onChange={(next) => onChange(next as ProgressView)}
		>
			<SegmentedControlItem
				value="list"
				label="List"
				isLabelHidden
				icon={<List aria-hidden />}
			/>
			<SegmentedControlItem
				value="chart"
				label="Graph"
				isLabelHidden
				icon={<ChartLine aria-hidden />}
			/>
		</SegmentedControl>
	);
}
