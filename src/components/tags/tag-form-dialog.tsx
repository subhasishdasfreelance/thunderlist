import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Token } from "@astryxdesign/core/Token";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import {
	ReminderField,
	useReminderDraft,
} from "#/components/common/reminder-field";
import { ScheduleFields } from "#/components/common/schedule-fields";
import { StageDot } from "#/components/common/stage-dot";
import { AccessField, useOwnAlone } from "#/components/teams/access-field";
import { type TagValues, useApplyChange } from "#/lib/changes";
import { isInlineTagName } from "#/lib/tags/inline-tags";
import type { AccessEntry } from "#/schemas/access";
import type { DailyWindow } from "#/schemas/common";
import {
	PICKABLE_COLORS,
	pickableColor,
	type Tag,
	type TagColor,
} from "#/schemas/tag";

/**
 * The colours as options to pick from — the eight, and gray for something
 * that wants no colour of its own. Task types use the same list; stages leave
 * gray out; see `STAGE_COLOR_OPTIONS`.
 *
 * Each carries its own dot, because a list of names is one you read and a
 * row of dots is one you look at.
 */
export const COLOR_OPTIONS = [...PICKABLE_COLORS, "gray" as const].map(
	(color) => ({
		value: color,
		label: `${color.charAt(0).toUpperCase()}${color.slice(1)}`,
		icon: <StageDot color={color} />,
	}),
);

/**
 * The colours a stage can be: the eight, without gray, which would read as
 * the track of the bar — the work not done.
 */
export const STAGE_COLOR_OPTIONS = COLOR_OPTIONS.filter(
	(option) => option.value !== "gray",
);

/**
 * Create or edit a tag.
 *
 * Renaming here is enough to rename it everywhere: tasks reference a tag by id,
 * so the name lives in exactly one place.
 *
 * The description and dates are a checklist's, and all of them are optional: a
 * tag without dates still counts its tasks, it just has no pace to keep.
 */
export function TagFormDialog({
	isOpen,
	onOpenChange,
	tag,
	existingNames,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	tag?: Tag;
	/** Every other tag name, so a duplicate is caught before it is queued. */
	existingNames: ReadonlyArray<string>;
	onSubmit: (values: TagValues) => void;
}) {
	const [name, setName] = useState("");
	const [color, setColor] = useState<TagColor>("blue");
	const [description, setDescription] = useState("");
	const [startDate, setStartDate] = useState<ISODateString | undefined>(
		undefined,
	);
	const [deadline, setDeadline] = useState<ISODateString | undefined>(
		undefined,
	);
	const [deadlineTime, setDeadlineTime] = useState<string | undefined>(
		undefined,
	);
	const [dailyWindow, setDailyWindow] = useState<DailyWindow | null>(null);
	/*
	 * Who it is for. A new one starts with nobody but its author — so adding
	 * someone to a team hands them nothing until they are put on something —
	 * and `null`, the whole team, stays a choice rather than the default; see
	 * `AccessField`.
	 */
	const ownAlone = useOwnAlone();
	const [access, setAccess] = useState<Array<AccessEntry> | null>(null);

	useEffect(() => {
		if (!isOpen) return;
		setName(tag?.name ?? "");
		setColor(tag?.color ?? "blue");
		setDescription(tag?.description ?? "");
		setStartDate((tag?.startDate as ISODateString | null) ?? undefined);
		setDeadline((tag?.deadline as ISODateString | null) ?? undefined);
		setDeadlineTime(tag?.deadlineTime ?? undefined);
		setDailyWindow(tag?.dailyWindow ?? null);
		setAccess(
			tag === null || tag === undefined
				? ownAlone
				: ((tag.access ?? null) as Array<AccessEntry> | null),
		);
	}, [isOpen, tag, ownAlone]);

	const trimmed = name.trim();
	const isDuplicate = existingNames.some(
		(existing) =>
			existing.toLowerCase() === trimmed.toLowerCase() &&
			existing.toLowerCase() !== tag?.name.toLowerCase(),
	);
	// Today is written into titles by the bolt, so its name has to read back as
	// the same tag; see `isInlineTagName`.
	const isUnwritable =
		tag?.special != null && trimmed !== "" && !isInlineTagName(trimmed);
	const isValid =
		trimmed !== "" &&
		!isDuplicate &&
		!isUnwritable &&
		(dailyWindow === null || dailyWindow.to > dailyWindow.from);

	// Your own daily reminder about it, saved with the rest; see `ReminderField`.
	const reminder = useReminderDraft(isOpen, "tag", tag?.tagId ?? null);
	const { apply: applyReminder } = useApplyChange();

	function save() {
		if (!isValid) return;
		reminder.save(applyReminder);
		onSubmit({
			name: trimmed,
			color,
			description: description.trim(),
			startDate: startDate ?? null,
			// Repeating daily takes the deadline's place; see `ScheduleFields`.
			deadline: dailyWindow === null ? (deadline ?? null) : null,
			deadlineTime:
				dailyWindow === null && deadline !== undefined
					? (deadlineTime ?? null)
					: null,
			dailyWindow,
			access,
		});
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={tag ? "Edit tag" : "New tag"}
			actions={() => (
				<HStack gap={2} hAlign="end">
					<Button
						label="Cancel"
						icon={<X aria-hidden />}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label={tag ? "Save changes" : "Create tag"}
						icon={<Check aria-hidden />}
						variant="primary"
						isDisabled={!isValid}
						onClick={save}
					/>
				</HStack>
			)}
		>
			<VStack gap={4}>
				<TextInput
					autoComplete="off"
					label="Name"
					isRequired
					value={name}
					onChange={setName}
					onEnter={save}
					placeholder="deep-work"
					status={
						isDuplicate
							? {
									type: "error",
									message: `There is already a "${trimmed}" tag.`,
								}
							: isUnwritable
								? {
										type: "error",
										message: "One word: it is written into tasks as #name.",
									}
								: undefined
					}
				/>

				<Selector
					label="Colour"
					options={COLOR_OPTIONS}
					value={pickableColor(color)}
					onChange={(next) => setColor(next as TagColor)}
				/>

				<HStack gap={2} vAlign="center">
					<Token
						size="md"
						color={color}
						label={trimmed === "" ? "Preview" : trimmed}
					/>
				</HStack>

				<TextArea
					autoComplete="off"
					label="Description"
					isOptional
					rows={3}
					value={description}
					onChange={setDescription}
					placeholder="What this tag gathers"
				/>

				<ScheduleFields
					startDate={startDate}
					deadline={deadline}
					deadlineTime={deadlineTime}
					dailyWindow={dailyWindow}
					onStartDateChange={setStartDate}
					onDeadlineChange={setDeadline}
					onDeadlineTimeChange={setDeadlineTime}
					onDailyWindowChange={setDailyWindow}
					isStartDateOptional
				/>

				{/* Only once it exists: a reminder is about something. */}
				{tag === undefined ? null : (
					<ReminderField value={reminder.time} onChange={reminder.setTime} />
				)}

				{/* Today is everyone's, in a team as anywhere. */}
				{tag?.special != null ? null : (
					<AccessField noun="tag" value={access} onChange={setAccess} />
				)}
			</VStack>
		</FormDialog>
	);
}
