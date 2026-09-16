import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import {
	ArrowDownWideNarrow,
	ChartNoAxesGantt,
	Check,
	Clock,
	Flame,
	type LucideIcon,
	Shapes,
} from "lucide-react";
import { SORT_ORDER_LABELS, type SortOrder } from "#/lib/tasks/tasks";

/** The mark each order is known by, the same one its idea carries elsewhere. */
const ORDER_ICONS: Record<SortOrder, LucideIcon> = {
	newest: Clock,
	priority: Flame,
	stage: ChartNoAxesGantt,
	type: Shapes,
};

/**
 * How a task list is ordered: newest first, the urgent and important first,
 * the earliest stage first, or by kind of work.
 *
 * A menu rather than a row of switches. There are four orders now and a switch
 * each would be four buttons competing to say which one is in force; a menu is
 * one button that always says it, and has room to say what each order means.
 *
 * The choice lives on the screen rather than in the database. It is a way of
 * looking at a list, not a property of it, and the next person to open the app
 * should get the list back the way lists normally read.
 */
export function SortMenu({
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
	const orders: Array<SortOrder> = [
		"newest",
		"priority",
		...(hasStageOrder ? (["stage"] as const) : []),
		"type",
	];

	return (
		<DropdownMenu
			placement="below"
			alignment="end"
			button={{
				label: SORT_ORDER_LABELS[order],
				tooltip: "How the list is ordered",
				// Lit while the list is in anything but its usual order, the way a
				// task's flags are lit, so it reads from across the screen.
				variant: order === "newest" ? "ghost" : "secondary",
				size: "sm",
				icon: <ArrowDownWideNarrow aria-hidden />,
			}}
			items={[
				{
					type: "section" as const,
					title: "Order",
					items: orders.map((each) => ({
						id: each,
						label: SORT_ORDER_LABELS[each],
						icon: ORDER_ICONS[each],
						endContent:
							each === order ? (
								<Icon icon={Check} size="sm" color="accent" />
							) : undefined,
						onClick: () => onChange(each),
					})),
				},
			]}
		/>
	);
}
