import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useQuery } from "@tanstack/react-query";
import {
	Check,
	CircleCheck,
	ListChecks,
	type LucideIcon,
	Tags,
	TrendingUp,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { searchIndexQuery } from "#/queries/system";
import { tagsQuery } from "#/queries/tags";
import type { ItemKind, ItemRef } from "#/schemas/common";

export const ITEM_KIND_ICONS: Record<ItemKind, LucideIcon> = {
	task: CircleCheck,
	checklist: ListChecks,
	tracker: TrendingUp,
	tag: Tags,
};

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
	task: "Task",
	checklist: "Checklist",
	tracker: "Tracker",
	tag: "Tag",
};

/** One thing to show: what it is called, and a word on where it lives. */
export type ItemInfo = ItemRef & { label: string; context: string };

/**
 * Every task, checklist, tracker and tag this person can see, named — for
 * showing what an `ItemRef` points at, and for picking one. Things not loaded
 * yet, deleted or kept from them are simply not in it.
 */
export function useItemDirectory(isEnabled = true): {
	items: Array<ItemInfo>;
	find: (ref: ItemRef) => ItemInfo | null;
	isPending: boolean;
} {
	const index = useQuery({ ...searchIndexQuery(), enabled: isEnabled });
	const tags = useQuery({ ...tagsQuery(), enabled: isEnabled });

	const items = useMemo<Array<ItemInfo>>(() => {
		const data = index.data;
		return [
			...(data?.checklists ?? []).map((each) => ({
				kind: "checklist" as const,
				id: each.checklistId,
				label: each.title,
				context: "Checklist",
			})),
			...(data?.trackers ?? []).map((each) => ({
				kind: "tracker" as const,
				id: each.trackerId,
				label: each.title,
				context: each.caption ? `Tracker · ${each.caption}` : "Tracker",
			})),
			...(tags.data ?? []).map((each) => ({
				kind: "tag" as const,
				id: each.tagId,
				label: `#${each.name}`,
				context: "Tag",
			})),
			...(data?.tasks ?? []).map((each) => ({
				kind: "task" as const,
				id: each.taskId,
				label: each.title,
				context: each.checklistTitle ?? "Task",
			})),
		];
	}, [index.data, tags.data]);

	const byKey = useMemo(
		() => new Map(items.map((item) => [`${item.kind}:${item.id}`, item])),
		[items],
	);

	return {
		items,
		find: (ref) => byKey.get(`${ref.kind}:${ref.id}`) ?? null,
		isPending: index.isPending || tags.isPending,
	};
}

const MAX_PER_KIND = 6;

/**
 * Picking things, the way search finds them: type, ↑ ↓ to move, Enter to pick
 * or unpick the one lit. Several can be picked before Done; each pick is
 * handed over as it is made, so whatever the dialog is picking for shows it
 * at once.
 */
export function ItemPickerDialog({
	isOpen,
	onOpenChange,
	title,
	kinds,
	picked,
	onToggle,
	isOffered = () => true,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	title: string;
	/** What can be picked, in the order the results come in. */
	kinds: ReadonlyArray<ItemKind>;
	picked: ReadonlyArray<ItemRef>;
	onToggle: (item: ItemRef) => void;
	/** Leave out anything that cannot be picked here. */
	isOffered?: (item: ItemRef) => boolean;
}) {
	const [query, setQuery] = useState("");
	const hasKeyboard = useMediaQuery("(pointer: fine)");
	const [active, setActive] = useState(0);
	const listId = useId();
	const directory = useItemDirectory(isOpen);

	const nouns = kinds
		.map((kind) => `${ITEM_KIND_LABELS[kind].toLowerCase()}s`)
		.join(", ")
		.replace(/, ([^,]*)$/, " and $1");

	const results = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return kinds.flatMap((kind) =>
			directory.items
				.filter(
					(item) =>
						item.kind === kind &&
						isOffered(item) &&
						item.label.toLowerCase().includes(needle),
				)
				.slice(0, MAX_PER_KIND),
		);
	}, [directory.items, kinds, query, isOffered]);

	// A new search lights its first result again, and so does opening.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on the words and on opening, not on the index behind them.
	useEffect(() => setActive(0), [query, isOpen]);
	// Each opening starts from an empty box.
	useEffect(() => {
		if (isOpen) setQuery("");
	}, [isOpen]);

	const lit = Math.min(active, Math.max(0, results.length - 1));
	const optionId = (index: number) => `${listId}-${index}`;
	const isPicked = (item: ItemRef) =>
		picked.some((each) => each.kind === item.kind && each.id === item.id);

	function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (results.length === 0) return;

		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			const next = (lit + step + results.length) % results.length;
			setActive(next);
			document
				.getElementById(optionId(next))
				?.scrollIntoView({ block: "nearest" });
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			const { kind, id } = results[lit];
			onToggle({ kind, id });
		}
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={title}
			width={520}
			actions={() => (
				<Button
					label="Done"
					icon={<Check aria-hidden />}
					variant="primary"
					onClick={() => onOpenChange(false)}
				/>
			)}
		>
			<VStack gap={3}>
				<TextInput
					autoComplete="off"
					label={`Search ${nouns}`}
					isLabelHidden
					// Straight to typing with a keyboard; on a phone the keyboard would
					// cover the list, which is usually what was wanted.
					hasAutoFocus={hasKeyboard}
					placeholder={`Search ${nouns}`}
					value={query}
					onChange={setQuery}
					onKeyDown={onKeyDown}
					isLoading={isOpen && directory.isPending}
					role="combobox"
					aria-expanded={results.length > 0}
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={results.length > 0 ? optionId(lit) : undefined}
				/>

				{results.length === 0 ? (
					directory.isPending ? null : (
						<EmptyState
							isCompact
							title="No matches"
							description={
								query.trim() === ""
									? `No ${nouns} to pick.`
									: `Nothing matched "${query.trim()}".`
							}
						/>
					)
				) : (
					<div
						id={listId}
						role="listbox"
						aria-label="Results"
						aria-multiselectable
						className="thunderlist-search-results"
					>
						{results.map((item, index) => {
							const isOn = isPicked(item);
							return (
								// biome-ignore lint/a11y/useKeyWithClickEvents: the keys are the box's; see `onKeyDown`.
								<div
									key={`${item.kind}:${item.id}`}
									id={optionId(index)}
									role="option"
									aria-selected={isOn}
									tabIndex={-1}
									className="thunderlist-search-result thunderlist-pick-result"
									data-active={index === lit}
									onMouseEnter={() => setActive(index)}
									onClick={() => onToggle({ kind: item.kind, id: item.id })}
								>
									<Icon
										icon={ITEM_KIND_ICONS[item.kind]}
										size="sm"
										color="secondary"
									/>
									<span className="thunderlist-pick-text">
										<span className="thunderlist-search-label">
											{item.label}
										</span>
										<span className="thunderlist-search-context">
											{item.context}
										</span>
									</span>
									{isOn ? <Icon icon={Check} size="sm" color="accent" /> : null}
								</div>
							);
						})}
					</div>
				)}

				{query.trim() === "" && results.length > 0 ? (
					<Text type="supporting">
						Type to narrow it down. ↑ ↓ to move, Enter to pick or unpick.
					</Text>
				) : null}
			</VStack>
		</FormDialog>
	);
}
