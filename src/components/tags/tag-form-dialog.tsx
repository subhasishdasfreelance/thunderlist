import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { ImagesField } from "#/components/common/images-field";
import { ScheduleFields } from "#/components/common/schedule-fields";
import { StageDot } from "#/components/common/stage-dot";
import { TextArea, TextInput } from "#/components/common/text-fields";
import { AccessField } from "#/components/teams/access-field";
import type { TagValues } from "#/lib/changes";
import { isInlineTagName } from "#/lib/tags/inline-tags";
import { useImageDraft } from "#/lib/uploads";
import type { AccessEntry } from "#/schemas/access";
import type { DailyWindow } from "#/schemas/common";
import {
	DONE_STAGE_KEY,
	PICKABLE_COLORS,
	pickableColor,
	type Tag,
	type TagColor,
	type TagStage,
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
 * Edit a tag. None is made here: a tag is made by writing it on something,
 * and goes once nothing carries it; see `deleteUnusedTags`.
 *
 * Renaming here is enough to rename it everywhere: tasks reference a tag by id,
 * so the name lives in exactly one place.
 *
 * The description and dates are a checklist's, and all of them are optional: a
 * tag without dates still counts its tasks, it just has no pace to keep.
 *
 * Each stage its tasks are at can be given a colour of its own on the tag's
 * bar; left alone, a stage keeps the colour its checklist gives it.
 */
export function TagFormDialog({
	isOpen,
	onOpenChange,
	tag,
	stages = [],
	existingNames,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	tag: Tag;
	/** The stages its tasks are under way at, to colour; see `TagStage`. */
	stages?: ReadonlyArray<TagStage>;
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
	const [startTime, setStartTime] = useState<string | undefined>(undefined);
	const [deadline, setDeadline] = useState<ISODateString | undefined>(
		undefined,
	);
	const [deadlineTime, setDeadlineTime] = useState<string | undefined>(
		undefined,
	);
	const [dailyWindow, setDailyWindow] = useState<DailyWindow | null>(null);
	// Who it is for; see `AccessField`.
	const [access, setAccess] = useState<Array<AccessEntry> | null>(null);
	const [stageColors, setStageColors] = useState<Record<string, TagColor>>({});
	const imageDraft = useImageDraft("tags", tag.tagId, tag.images, isOpen);

	useEffect(() => {
		if (!isOpen) return;
		setName(tag.name);
		setColor(tag.color);
		setDescription(tag.description);
		setStartDate((tag.startDate as ISODateString | null) ?? undefined);
		setStartTime(tag.startTime ?? undefined);
		setDeadline((tag.deadline as ISODateString | null) ?? undefined);
		setDeadlineTime(tag.deadlineTime ?? undefined);
		setDailyWindow(tag.dailyWindow ?? null);
		setStageColors(tag.stageColors ?? {});
		setAccess((tag.access ?? null) as Array<AccessEntry> | null);
	}, [isOpen, tag]);

	const trimmed = name.trim();
	const isDuplicate = existingNames.some(
		(existing) =>
			existing.toLowerCase() === trimmed.toLowerCase() &&
			existing.toLowerCase() !== tag.name.toLowerCase(),
	);
	// Today is written into titles by the bolt, so its name has to read back as
	// the same tag; see `isInlineTagName`.
	const isUnwritable =
		tag.special != null && trimmed !== "" && !isInlineTagName(trimmed);
	const isValid =
		trimmed !== "" &&
		!isDuplicate &&
		!isUnwritable &&
		(dailyWindow === null || dailyWindow.to > dailyWindow.from);

	function save() {
		if (!isValid) return;
		const images = imageDraft.commit();
		onSubmit({
			name: trimmed,
			color,
			description: description.trim(),
			startDate: startDate ?? null,
			// A time only means something on a day; see `ScheduleFields`.
			startTime: startDate === undefined ? null : (startTime ?? null),
			// Repeating daily takes the deadline's place; see `ScheduleFields`.
			deadline: dailyWindow === null ? (deadline ?? null) : null,
			deadlineTime:
				dailyWindow === null && deadline !== undefined
					? (deadlineTime ?? null)
					: null,
			dailyWindow,
			access,
			stageColors,
			...(images === undefined ? {} : { images }),
		});
	}

	// Done first, then the stages under way, as the bar draws them.
	const colorable = [
		{ key: DONE_STAGE_KEY, name: "Done", color: "green" as TagColor },
		...stages,
	];

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			number={{ kind: "tag", number: tag.number }}
			title="Edit tag"
			actions={() => (
				<HStack gap={2} hAlign="end">
					<Button
						label="Cancel"
						icon={<X aria-hidden />}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label="Save changes"
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

				<ImagesField draft={imageDraft} />

				<ScheduleFields
					startDate={startDate}
					startTime={startTime}
					deadline={deadline}
					deadlineTime={deadlineTime}
					dailyWindow={dailyWindow}
					onStartDateChange={setStartDate}
					onStartTimeChange={setStartTime}
					onDeadlineChange={setDeadline}
					onDeadlineTimeChange={setDeadlineTime}
					onDailyWindowChange={setDailyWindow}
					isStartDateOptional
				/>

				<VStack gap={2}>
					<Text type="label" weight="semibold">
						Stage colours
					</Text>
					{colorable.map((stage) => (
						<Selector
							key={stage.key}
							label={stage.name}
							options={STAGE_COLOR_OPTIONS}
							value={pickableColor(stageColors[stage.key] ?? stage.color)}
							onChange={(next) =>
								setStageColors((held) => ({
									...held,
									[stage.key]: next as TagColor,
								}))
							}
						/>
					))}
				</VStack>

				{/* Today is everyone's, in a team as anywhere. */}
				{tag.special != null ? null : (
					<AccessField noun="tag" value={access} onChange={setAccess} />
				)}
			</VStack>
		</FormDialog>
	);
}
