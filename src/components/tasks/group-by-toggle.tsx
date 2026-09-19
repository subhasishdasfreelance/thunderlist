import {
	SegmentedControl,
	SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { Shapes, SquareKanban } from "lucide-react";
import type { GroupBy } from "#/schemas/task";

/**
 * Stage or type: which way the screen cuts the same rows.
 *
 * A switch rather than a menu, because there are two of them and both are
 * worth reading at once — "there is another way to look at this" is half of
 * what the control is for. It leads the filter row, since it decides what the
 * tabs under it are naming.
 */
export function GroupByToggle({
	value,
	onChange,
}: {
	value: GroupBy;
	onChange: (value: GroupBy) => void;
}) {
	return (
		<SegmentedControl
			label="Group tasks by"
			size="sm"
			value={value}
			onChange={(next) => onChange(next as GroupBy)}
		>
			<SegmentedControlItem
				value="stage"
				label="Stage"
				icon={<SquareKanban aria-hidden />}
			/>
			<SegmentedControlItem
				value="type"
				label="Type"
				icon={<Shapes aria-hidden />}
			/>
		</SegmentedControl>
	);
}
