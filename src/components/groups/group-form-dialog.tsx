import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Check, Plus, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import {
	ITEM_KIND_ICONS,
	ItemPickerDialog,
	useItemDirectory,
} from "#/components/common/item-picker-dialog";
import { ScheduleFields } from "#/components/common/schedule-fields";
import { TextInput } from "#/components/common/text-fields";
import { COLOR_OPTIONS } from "#/components/tags/tag-form-dialog";
import { todayDateOnly } from "#/schemas/common";
import {
	GROUP_ITEM_KINDS,
	type Group,
	type GroupItem,
	groupStartDate,
	sameItem,
} from "#/schemas/group";
import { pickableColor, type TagColor } from "#/schemas/tag";
import { GroupBadge } from "./group-card";

export type GroupValues = {
	name: string;
	color: TagColor;
	items: Array<GroupItem>;
	startDate: string;
	deadline: string | null;
	/** `HH:MM` on the deadline day; see `Group.deadlineTime`. */
	deadlineTime: string | null;
};

/**
 * Make a group, or change one: its name, its colour, its schedule — paced
 * like a checklist, across every task in it — and what is in it: checklists,
 * trackers and tags, picked the way search finds them.
 */
export function GroupFormDialog({
	isOpen,
	onOpenChange,
	group,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** The group being edited; absent for a new one. */
	group?: Group;
	onSubmit: (values: GroupValues) => void;
}) {
	const [name, setName] = useState("");
	const [color, setColor] = useState<TagColor>("blue");
	const [items, setItems] = useState<Array<GroupItem>>([]);
	const [startDate, setStartDate] = useState<ISODateString | undefined>(
		undefined,
	);
	const [deadline, setDeadline] = useState<ISODateString | undefined>(
		undefined,
	);
	const [deadlineTime, setDeadlineTime] = useState<string | undefined>(
		undefined,
	);
	const [isPicking, setIsPicking] = useState(false);
	const directory = useItemDirectory(isOpen);

	// biome-ignore lint/correctness/useExhaustiveDependencies: read as it opens, not followed while it is open.
	useEffect(() => {
		if (!isOpen) return;
		setName(group?.name ?? "");
		setColor(group?.color ?? "blue");
		setItems(group?.items ?? []);
		setStartDate(
			(group === undefined
				? todayDateOnly()
				: groupStartDate(group)) as ISODateString,
		);
		setDeadline((group?.deadline as ISODateString | null) ?? undefined);
		setDeadlineTime(group?.deadlineTime ?? undefined);
	}, [isOpen]);

	const trimmed = name.trim();
	// Only the things this person can see are listed; the rest stay as they
	// were; see `Group`.
	const shown = items.flatMap((item) => {
		const info = directory.find(item);
		return info === null ? [] : [info];
	});

	function toggle(item: GroupItem) {
		setItems((held) =>
			held.some((each) => sameItem(each, item))
				? held.filter((each) => !sameItem(each, item))
				: [...held, item],
		);
	}

	function submit(event: FormEvent) {
		event.preventDefault();
		if (trimmed === "" || startDate === undefined) return;
		onSubmit({
			name: trimmed,
			color,
			items,
			startDate,
			deadline: deadline ?? null,
			// A time only means something on a day; see `ScheduleFields`.
			deadlineTime: deadline === undefined ? null : (deadlineTime ?? null),
		});
	}

	return (
		<>
			<FormDialog
				isOpen={isOpen}
				onOpenChange={onOpenChange}
				number={{ kind: "group", number: group?.number }}
				title={group ? "Edit group" : "New group"}
				onSubmit={submit}
				actions={(formId) => (
					<HStack gap={2} hAlign="end">
						<Button
							label="Cancel"
							icon={<X aria-hidden />}
							variant="ghost"
							onClick={() => onOpenChange(false)}
						/>
						<Button
							label={group ? "Save changes" : "Create group"}
							icon={<Check aria-hidden />}
							variant="primary"
							type="submit"
							form={formId}
							isDisabled={trimmed === "" || startDate === undefined}
						/>
					</HStack>
				)}
			>
				<VStack gap={4}>
					<HStack gap={3} vAlign="end">
						<GroupBadge group={{ color }} size="lg" />
						<span className="min-w-0 flex-1">
							<TextInput
								autoComplete="off"
								label="Name"
								isRequired
								value={name}
								onChange={setName}
								placeholder="Launch, Home, Q4…"
								width="100%"
							/>
						</span>
					</HStack>

					<Selector
						label="Colour"
						options={COLOR_OPTIONS}
						value={pickableColor(color)}
						onChange={(next) => setColor(next as TagColor)}
					/>

					<ScheduleFields
						startDate={startDate}
						deadline={deadline}
						deadlineTime={deadlineTime}
						onStartDateChange={setStartDate}
						onDeadlineChange={setDeadline}
						onDeadlineTimeChange={setDeadlineTime}
					/>

					<VStack gap={2}>
						<HStack gap={2} hAlign="between" vAlign="center">
							<Text type="label" weight="semibold">
								In this group
							</Text>
							<Button
								label="Add"
								icon={<Plus aria-hidden />}
								variant="secondary"
								size="sm"
								onClick={() => setIsPicking(true)}
							/>
						</HStack>
						{shown.length === 0 ? (
							<Text type="supporting">
								Nothing yet. Add checklists, trackers and tags — any mix.
							</Text>
						) : (
							<VStack gap={0.5}>
								{shown.map((item) => (
									<HStack
										key={`${item.kind}:${item.id}`}
										gap={2}
										vAlign="center"
										paddingBlock={0.5}
									>
										<Icon
											icon={ITEM_KIND_ICONS[item.kind]}
											size="sm"
											color="secondary"
										/>
										<span className="min-w-0 flex-1">
											<Text maxLines={1}>{item.label}</Text>
										</span>
										<IconButton
											label={`Take ${item.label} out`}
											tooltip="Take out"
											variant="ghost"
											size="sm"
											icon={<X aria-hidden />}
											onClick={() =>
												toggle({
													kind: item.kind as GroupItem["kind"],
													id: item.id,
												})
											}
										/>
									</HStack>
								))}
							</VStack>
						)}
					</VStack>
				</VStack>
			</FormDialog>

			<ItemPickerDialog
				isOpen={isPicking}
				onOpenChange={setIsPicking}
				title="Add to group"
				kinds={GROUP_ITEM_KINDS}
				picked={items}
				onToggle={(item) => toggle(item as GroupItem)}
			/>
		</>
	);
}
