import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import {
	ArrowDown,
	ArrowUp,
	Check,
	FolderInput,
	FolderMinus,
	Plus,
	Trash2,
	X,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { createId, ID_PREFIX } from "#/lib/ids";
import type { Arrangement, ListGroup } from "#/schemas/arrangement";

type Item = { id: string; label: string };

/**
 * Arranging a list by hand: its order, and its groups.
 *
 * Every card on the page is a row here, under the group it is in. ↑ and ↓
 * move a row within its group; "Group" moves it into another, or out of all
 * of them. Groups are made, renamed and deleted in the same place — deleting
 * one leaves its cards ungrouped, never deleted.
 *
 * Nothing is saved until Save: a layout is several moves, and a half-made one
 * is not worth drawing on the page behind.
 *
 * The order made here is the one the list shows when it is set to "Your
 * order"; the other orders sort within each group.
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
	const [groups, setGroups] = useState<Array<ListGroup>>([]);
	const [newName, setNewName] = useState("");

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
		setGroups(arrangement.groups.map((group) => ({ ...group })));
		setNewName("");
	}, [isOpen]);

	const groupOf = (id: string) =>
		groups.find((group) => group.itemIds.includes(id)) ?? null;
	const byId = new Map(items.map((item) => [item.id, item]));
	const shownOrder = order.filter((id) => byId.has(id));

	/** The rows of one group — `null` for the ungrouped — in the order drawn. */
	const rowsOf = (groupId: string | null) =>
		shownOrder.filter((id) => (groupOf(id)?.groupId ?? null) === groupId);

	/**
	 * One row a step up or down among its own group's rows. The rows of the
	 * group hold their slots in the whole order, and swap within them.
	 */
	function move(id: string, step: -1 | 1) {
		const rows = rowsOf(groupOf(id)?.groupId ?? null);
		const at = rows.indexOf(id);
		const to = at + step;
		if (to < 0 || to >= rows.length) return;

		const swapped = [...rows];
		[swapped[at], swapped[to]] = [swapped[to], swapped[at]];
		const slots = new Set(rows);
		let next = 0;
		setOrder(order.map((each) => (slots.has(each) ? swapped[next++] : each)));
	}

	/** Into a group — last in it — or out of every group for `null`. */
	function regroup(id: string, groupId: string | null) {
		setGroups(
			groups.map((group) => ({
				...group,
				itemIds:
					group.groupId === groupId
						? [...group.itemIds.filter((each) => each !== id), id]
						: group.itemIds.filter((each) => each !== id),
			})),
		);
		// Last among its new neighbours, so it arrives at the foot of the group.
		setOrder([...order.filter((each) => each !== id), id]);
	}

	const trimmedNew = newName.trim();
	const isNameTaken = (name: string, except?: string) =>
		groups.some(
			(group) =>
				group.groupId !== except &&
				group.name.toLowerCase() === name.toLowerCase(),
		);
	const canAdd = trimmedNew !== "" && !isNameTaken(trimmedNew);

	function addGroup(event?: FormEvent) {
		event?.preventDefault();
		if (!canAdd) return;
		setGroups([
			...groups,
			{ groupId: createId(ID_PREFIX.group), name: trimmedNew, itemIds: [] },
		]);
		setNewName("");
	}

	const problem = groups.some((group) => group.name.trim() === "")
		? "Every group needs a name."
		: groups.some((group) => isNameTaken(group.name.trim(), group.groupId))
			? "Two groups can't share a name."
			: null;

	function save() {
		if (problem !== null) return;
		onSave({
			order,
			groups: groups.map((group) => ({ ...group, name: group.name.trim() })),
		});
	}

	const row = (id: string, index: number, count: number) => {
		const item = byId.get(id);
		if (item === undefined) return null;
		const current = groupOf(id);

		return (
			<HStack key={id} gap={1} vAlign="center" paddingBlock={0.5}>
				<span className="min-w-0 flex-1">
					<Text maxLines={1}>{item.label}</Text>
				</span>
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
					isDisabled={index === count - 1}
					onClick={() => move(id, 1)}
				/>
				{groups.length === 0 ? null : (
					<DropdownMenu
						hasChevron={false}
						placement="below"
						alignment="end"
						button={{
							label: `Group for ${item.label}`,
							tooltip: "Group",
							variant: "ghost",
							size: "sm",
							isIconOnly: true,
							icon: <FolderInput aria-hidden />,
						}}
						items={[
							{
								type: "section" as const,
								title: "Group",
								items: [
									...groups.map((group) => ({
										id: group.groupId,
										label: group.name,
										endContent:
											current?.groupId === group.groupId ? (
												<Icon icon={Check} size="sm" color="accent" />
											) : undefined,
										onClick: () => regroup(id, group.groupId),
									})),
									{
										id: "none",
										label: "No group",
										icon: FolderMinus,
										endContent:
											current === null ? (
												<Icon icon={Check} size="sm" color="accent" />
											) : undefined,
										onClick: () => regroup(id, null),
									},
								],
							},
						]}
					/>
				)}
			</HStack>
		);
	};

	const loose = rowsOf(null);

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={`Arrange ${noun}`}
			subtitle="Your order, and your groups."
			width={520}
			actions={() => (
				<HStack gap={2} hAlign="end" vAlign="center">
					{problem === null ? null : <Text type="supporting">{problem}</Text>}
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
						onClick={save}
					/>
				</HStack>
			)}
		>
			<VStack gap={4}>
				<form onSubmit={addGroup} autoComplete="off">
					<HStack gap={2} vAlign="end">
						<span className="min-w-0 flex-1">
							<TextInput
								autoComplete="off"
								label="New group"
								placeholder="Work, Home, Q4…"
								value={newName}
								onChange={setNewName}
								width="100%"
								status={
									trimmedNew !== "" && isNameTaken(trimmedNew)
										? {
												type: "error",
												message: "There is a group of that name.",
											}
										: undefined
								}
							/>
						</span>
						<Button
							label="Add group"
							icon={<Plus aria-hidden />}
							variant="secondary"
							type="submit"
							isDisabled={!canAdd}
						/>
					</HStack>
				</form>

				{groups.map((group) => {
					const rows = rowsOf(group.groupId);
					return (
						<VStack key={group.groupId} gap={1}>
							<HStack gap={1} vAlign="center">
								<span className="min-w-0 flex-1">
									<TextInput
										autoComplete="off"
										label={`Name of group ${group.name}`}
										isLabelHidden
										value={group.name}
										onChange={(name) =>
											setGroups(
												groups.map((each) =>
													each.groupId === group.groupId
														? { ...each, name }
														: each,
												),
											)
										}
										width="100%"
									/>
								</span>
								<IconButton
									label={`Delete group ${group.name}`}
									tooltip="Delete group — its cards stay, ungrouped"
									variant="ghost"
									size="sm"
									icon={<Trash2 aria-hidden />}
									onClick={() =>
										setGroups(
											groups.filter((each) => each.groupId !== group.groupId),
										)
									}
								/>
							</HStack>
							{rows.length === 0 ? (
								<Text type="supporting">
									Empty. Move {noun} in with the folder beside each.
								</Text>
							) : (
								rows.map((id, index) => row(id, index, rows.length))
							)}
							<Divider />
						</VStack>
					);
				})}

				<VStack gap={1}>
					{groups.length === 0 ? null : (
						<Text type="label" weight="semibold" color="secondary">
							Not in a group
						</Text>
					)}
					{loose.length === 0 ? (
						<Text type="supporting">Everything is in a group.</Text>
					) : (
						loose.map((id, index) => row(id, index, loose.length))
					)}
				</VStack>
			</VStack>
		</FormDialog>
	);
}
