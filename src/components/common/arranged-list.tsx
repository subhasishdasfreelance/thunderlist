import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { VStack } from "@astryxdesign/core/Stack";
import { useQuery } from "@tanstack/react-query";
import {
	ArrowDownWideNarrow,
	ArrowUpDown,
	Check,
	Clock,
	GripVertical,
	ListChecks,
	type LucideIcon,
	TriangleAlert,
} from "lucide-react";
import { type ReactNode, useMemo, useSyncExternalStore } from "react";
import { Pickable } from "#/components/common/pickable";
import type { ApplyChange } from "#/lib/changes";
import type { usePickMode } from "#/lib/use-pick-mode";
import { arrangementsQuery } from "#/queries/space";
import {
	type ArrangedList,
	type Arrangement,
	EMPTY_ARRANGEMENT,
	type ListOrder,
	manualOrder,
} from "#/schemas/arrangement";

const ORDERS: Array<{ order: ListOrder; label: string; icon: LucideIcon }> = [
	{ order: "manual", label: "Your order", icon: GripVertical },
	{ order: "newest", label: "Newest first", icon: Clock },
	{ order: "behind", label: "Most behind first", icon: TriangleAlert },
];

/**
 * The order picked for each list, for as long as the app is open. Not kept in
 * this browser: nothing is kept on a device that is not saved as well.
 */
const pickedOrders = new Map<ArrangedList, ListOrder>();

/** Every list shown on screen, told when one of their orders is picked. */
const orderListeners = new Set<() => void>();

function subscribeToOrders(listener: () => void): () => void {
	orderListeners.add(listener);
	return () => orderListeners.delete(listener);
}

/**
 * How one list of cards is ordered — by hand, newest first, or most behind
 * first.
 *
 * Remembered while the app is open rather than saved: it is a way of looking
 * at the list, and someone else in the team may want to look at it another
 * way. The order picked by hand is the space's, and saved; see `Arrangement`.
 */
function useListOrder(
	list: ArrangedList,
): [ListOrder, (next: ListOrder) => void] {
	const order = useSyncExternalStore(
		subscribeToOrders,
		() => pickedOrders.get(list) ?? "manual",
		() => "manual" as const,
	);

	return [
		order,
		(next) => {
			pickedOrders.set(list, next);
			for (const listener of orderListeners) listener();
		},
	];
}

/**
 * One list laid out, in the order picked.
 *
 * `compareBehind` answers "which needs me first" on the viewer's clock, and is
 * `null` until the browser has read it — the list keeps its hand-picked order
 * until then rather than jumping.
 */
export function useArrangedList<T>({
	list,
	items,
	idOf,
	createdAt,
	compareBehind,
}: {
	list: ArrangedList;
	items: ReadonlyArray<T>;
	idOf: (item: T) => string;
	createdAt: (item: T) => string;
	compareBehind: ((a: T, b: T) => number) | null;
}): {
	arrangement: Arrangement;
	order: ListOrder;
	setOrder: (next: ListOrder) => void;
	/** Every item, in the order the hand-picked list puts them. */
	byHand: Array<T>;
	/** Every item, in the order picked. */
	ordered: Array<T>;
} {
	const [order, setOrder] = useListOrder(list);
	const arrangement =
		useQuery(arrangementsQuery()).data?.[list] ?? EMPTY_ARRANGEMENT;

	const byHand = useMemo(
		() => manualOrder(items, idOf, arrangement.order),
		[items, idOf, arrangement.order],
	);

	const ordered = useMemo(() => {
		if (order === "newest") {
			return [...items].sort((a, b) =>
				createdAt(b).localeCompare(createdAt(a)),
			);
		}
		if (order === "behind" && compareBehind !== null) {
			return [...byHand].sort(compareBehind);
		}
		return byHand;
	}, [order, items, byHand, createdAt, compareBehind]);

	return { arrangement, order, setOrder, byHand, ordered };
}

/** The order a list is in, picked from a menu; see `useArrangedList`. */
export function ListOrderMenu({
	order,
	onChange,
}: {
	order: ListOrder;
	onChange: (next: ListOrder) => void;
}) {
	const current = ORDERS.find((each) => each.order === order) ?? ORDERS[0];

	return (
		<DropdownMenu
			placement="below"
			alignment="end"
			button={{
				label: current.label,
				tooltip: "How the list is ordered",
				variant: "ghost",
				size: "sm",
				icon: <ArrowDownWideNarrow aria-hidden />,
			}}
			items={[
				{
					type: "section" as const,
					title: "Order",
					items: ORDERS.map((each) => ({
						id: each.order,
						label: each.label,
						icon: each.icon,
						endContent:
							each.order === order ? (
								<Icon icon={Check} size="sm" color="accent" />
							) : undefined,
						onClick: () => onChange(each.order),
					})),
				},
			]}
		/>
	);
}

/** The cards of a list, in the order picked; see `useArrangedList`. */
export function ArrangedCards<T>({
	items,
	idOf,
	render,
	pick,
}: {
	items: ReadonlyArray<T>;
	idOf: (item: T) => string;
	render: (item: T) => ReactNode;
	/**
	 * Picking cards to do something to all of them, while the screen is; see
	 * `usePickMode`. `labelOf` names a card for a screen reader.
	 */
	pick?: {
		mode: ReturnType<typeof usePickMode>;
		labelOf: (item: T) => string;
		isPickable?: (item: T) => boolean;
	};
}) {
	return (
		<VStack gap={3}>
			{items.map((item) => {
				const id = idOf(item);
				return (
					<div key={id}>
						{pick === undefined ? (
							render(item)
						) : (
							<Pickable
								isPicking={pick.mode.isPicking}
								isPicked={pick.mode.picked.has(id)}
								isPickable={pick.isPickable?.(item) ?? true}
								label={pick.labelOf(item)}
								onToggle={() => pick.mode.toggle(id)}
							>
								{render(item)}
							</Pickable>
						)}
					</div>
				);
			})}
		</VStack>
	);
}

/**
 * Starts picking cards, to delete or change several at once; see
 * `usePickMode`.
 */
export function SelectButton({ onClick }: { onClick: () => void }) {
	return (
		<IconButton
			label="Select"
			tooltip="Select several"
			variant="ghost"
			size="sm"
			icon={<ListChecks aria-hidden />}
			onClick={onClick}
		/>
	);
}

/** Save one list's arrangement; drawn at once, like every change. */
export function saveArrangement(
	apply: ApplyChange,
	list: ArrangedList,
	arrangement: Arrangement,
): void {
	apply({ kind: "arrangement.set", list, arrangement });
}

/** Opens `ArrangeDialog`: the list's order by hand. */
export function ArrangeButton({ onClick }: { onClick: () => void }) {
	return (
		<IconButton
			label="Arrange"
			tooltip="Arrange"
			variant="ghost"
			size="sm"
			icon={<ArrowUpDown aria-hidden />}
			onClick={onClick}
		/>
	);
}
