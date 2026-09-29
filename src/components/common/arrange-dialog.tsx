import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import type { Arrangement } from "#/schemas/arrangement";

type Item = { id: string; label: string };

/**
 * Ordering a list by hand. Every card on the page is a row here; ↑ and ↓ move
 * it. Collecting cards together is what groups are for; see the Groups page.
 *
 * Nothing is saved until Save: an order is several moves, and a half-made one
 * is not worth drawing on the page behind.
 *
 * The order made here is the one the list shows when it is set to "Your
 * order".
 */
export function ArrangeDialog({
	isOpen,
	onOpenChange,
	noun,
	items,
	arrangement,
	onSave,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** What the list is of, plural: "checklists". */
	noun: string;
	/** Every card on the list, in the order picked by hand. */
	items: ReadonlyArray<Item>;
	arrangement: Arrangement;
	onSave: (next: Arrangement) => void;
}) {
	const [order, setOrder] = useState<Array<string>>([]);

	// A fresh draft every time it opens, from the list as it is drawn.
	// biome-ignore lint/correctness/useExhaustiveDependencies: read as it opens, not followed while it is open.
	useEffect(() => {
		if (!isOpen) return;
		const shown = items.map((item) => item.id);
		// Anything the arrangement places that is not on screen — kept from
		// this person, say — keeps its place after everything shown.
		setOrder([
			...shown,
			...arrangement.order.filter((id) => !shown.includes(id)),
		]);
	}, [isOpen]);

	const byId = new Map(items.map((item) => [item.id, item]));
	const rows = order.filter((id) => byId.has(id));

	/**
	 * One row a step up or down. The rows shown hold their slots in the whole
	 * order, and swap within them.
	 */
	function move(id: string, step: -1 | 1) {
		const at = rows.indexOf(id);
		const to = at + step;
		if (to < 0 || to >= rows.length) return;

		const swapped = [...rows];
		[swapped[at], swapped[to]] = [swapped[to], swapped[at]];
		const slots = new Set(rows);
		let next = 0;
		setOrder(order.map((each) => (slots.has(each) ? swapped[next++] : each)));
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={`Arrange ${noun}`}
			subtitle="The order they show in, set to “Your order”."
			width={520}
			actions={() => (
				<HStack gap={2} hAlign="end" vAlign="center">
					<Button
						label="Cancel"
						icon={<X aria-hidden />}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label="Save"
						icon={<Check aria-hidden />}
						variant="primary"
						onClick={() => onSave({ order })}
					/>
				</HStack>
			)}
		>
			<VStack gap={1}>
				{rows.map((id, index) => {
					const item = byId.get(id);
					if (item === undefined) return null;

					return (
						<HStack key={id} gap={1} vAlign="center" paddingBlock={0.5}>
							<span className="min-w-0 flex-1">
								<Text maxLines={1}>{item.label}</Text>
							</span>
							{/* Finger-sized on a touch screen; see `.thunderlist-row-buttons`. */}
							<span className="thunderlist-row-buttons flex items-center gap-1">
								<IconButton
									label={`Move ${item.label} up`}
									tooltip="Up"
									variant="ghost"
									size="sm"
									icon={<ArrowUp aria-hidden />}
									isDisabled={index === 0}
									onClick={() => move(id, -1)}
								/>
								<IconButton
									label={`Move ${item.label} down`}
									tooltip="Down"
									variant="ghost"
									size="sm"
									icon={<ArrowDown aria-hidden />}
									isDisabled={index === rows.length - 1}
									onClick={() => move(id, 1)}
								/>
							</span>
						</HStack>
					);
				})}
			</VStack>
		</FormDialog>
	);
}
