import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import {
	ArrowDownWideNarrow,
	Check,
	Clock,
	FolderTree,
	GripVertical,
	type LucideIcon,
	TriangleAlert,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { ApplyChange } from "#/lib/changes";
import { arrangementsQuery } from "#/queries/space";
import {
	type ArrangedList,
	type Arrangement,
	EMPTY_ARRANGEMENT,
	type ListOrder,
	type ListSection,
	manualOrder,
	sectionsOf,
} from "#/schemas/arrangement";

const ORDERS: Array<{ order: ListOrder; label: string; icon: LucideIcon }> = [
	{ order: "manual", label: "Your order", icon: GripVertical },
	{ order: "newest", label: "Newest first", icon: Clock },
	{ order: "behind", label: "Most behind first", icon: TriangleAlert },
];

/** Where each list's order is remembered, in this browser. */
const storageKey = (list: ArrangedList) => `thunderlist.order.${list}.v1`;

/**
 * How one list of cards is ordered — by hand, newest first, or most behind
 * first.
 *
 * Remembered in this browser rather than saved: it is a way of looking at the
 * list, and someone else in the team may want to look at it another way. The
 * order picked by hand is the space's, and saved; see `Arrangement`.
 */
function useListOrder(
	list: ArrangedList,
): [ListOrder, (next: ListOrder) => void] {
	const [order, setOrder] = useState<ListOrder>("manual");

	// Read after the first paint, so the server's page and the browser's agree.
	useEffect(() => {
		try {
			const saved = window.localStorage.getItem(storageKey(list));
			if (saved === "manual" || saved === "newest" || saved === "behind") {
				setOrder(saved);
			}
		} catch {
			// No storage — a private window — is the default order.
		}
	}, [list]);

	return [
		order,
		(next) => {
			setOrder(next);
			try {
				window.localStorage.setItem(storageKey(list), next);
			} catch {
				// Kept for this visit only.
			}
		},
	];
}

/**
 * One list laid out: in the order picked, cut into its groups.
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
	sections: Array<ListSection<T>>;
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

	const sections = useMemo(
		() => sectionsOf(ordered, idOf, arrangement.groups),
		[ordered, idOf, arrangement.groups],
	);

	return { arrangement, order, setOrder, byHand, sections };
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

/**
 * The cards of a list, a group at a time: each group under its name, and the
 * ones in no group after them — under a heading of their own only when there
 * are groups to tell them apart from.
 */
export function ArrangedSections<T>({
	sections,
	idOf,
	render,
}: {
	sections: ReadonlyArray<ListSection<T>>;
	idOf: (item: T) => string;
	render: (item: T) => ReactNode;
}) {
	const hasGroups = sections.some((section) => section.group !== null);

	return (
		<VStack gap={4}>
			{sections.map((section) => (
				<VStack key={section.group?.groupId ?? "ungrouped"} gap={2}>
					{section.group === null && !hasGroups ? null : (
						<HStack gap={2} vAlign="center">
							<Text type="label" weight="semibold" color="secondary">
								{section.group?.name ?? "Not in a group"}
							</Text>
							<Text type="supporting">{section.items.length}</Text>
						</HStack>
					)}
					<VStack gap={3}>
						{section.items.map((item) => (
							<div key={idOf(item)}>{render(item)}</div>
						))}
					</VStack>
				</VStack>
			))}
		</VStack>
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

/** Opens `ArrangeDialog`: the list's order by hand, and its groups. */
export function ArrangeButton({ onClick }: { onClick: () => void }) {
	return (
		<IconButton
			label="Arrange and group"
			tooltip="Arrange and group"
			variant="ghost"
			size="sm"
			icon={<FolderTree aria-hidden />}
			onClick={onClick}
		/>
	);
}
