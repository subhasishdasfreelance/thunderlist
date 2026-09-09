import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { type FormEvent, useEffect, useState } from "react";
import { FieldRow } from "#/components/common/field-row";
import { FormDialog } from "#/components/common/form-dialog";
import { ScheduleFields } from "#/components/common/schedule-fields";
import type { TrackerValues } from "#/lib/changes";
import { todayDateOnly } from "#/schemas/common";
import {
	TRACKER_TYPE_DEFAULT_UNITS,
	TRACKER_TYPE_LABELS,
	TRACKER_TYPES,
	type Tracker,
	type TrackerType,
} from "#/schemas/tracker";

const TYPE_OPTIONS = TRACKER_TYPES.map((type) => ({
	value: type,
	label: TRACKER_TYPE_LABELS[type],
}));

/**
 * Create or edit a tracker.
 *
 * Type only changes defaults and which extra fields appear; the underlying
 * record is the same for a book, a course or a running goal.
 */
export function TrackerFormDialog({
	isOpen,
	onOpenChange,
	tracker,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	tracker?: Tracker;
	onSubmit: (values: TrackerValues) => void;
}) {
	const [title, setTitle] = useState("");
	const [type, setType] = useState<TrackerType>("book");
	const [unit, setUnit] = useState("pages");
	const [targetValue, setTargetValue] = useState<number | null>(null);
	const [startDate, setStartDate] = useState<ISODateString | undefined>(
		undefined,
	);
	const [deadline, setDeadline] = useState<ISODateString | undefined>(
		undefined,
	);
	const [description, setDescription] = useState("");
	const [coverUrl, setCoverUrl] = useState("");
	const [author, setAuthor] = useState("");

	useEffect(() => {
		if (!isOpen) return;
		setTitle(tracker?.title ?? "");
		setType(tracker?.type ?? "book");
		setUnit(tracker?.unit ?? TRACKER_TYPE_DEFAULT_UNITS.book);
		setTargetValue(tracker?.targetValue ?? null);
		setStartDate(
			(tracker?.startDate as ISODateString | undefined) ??
				(todayDateOnly() as ISODateString),
		);
		setDeadline((tracker?.deadline as ISODateString | null) ?? undefined);
		setDescription(tracker?.description ?? "");
		setCoverUrl(tracker?.coverUrl ?? "");
		setAuthor(tracker?.author ?? "");
	}, [isOpen, tracker]);

	/** Switching type suggests its usual unit, but never overwrites a custom one. */
	function changeType(next: string) {
		const nextType = next as TrackerType;
		setType(nextType);
		setUnit((current) =>
			current === "" ||
			Object.values(TRACKER_TYPE_DEFAULT_UNITS).includes(current)
				? TRACKER_TYPE_DEFAULT_UNITS[nextType]
				: current,
		);
	}

	const trimmedTitle = title.trim();
	const isValid =
		trimmedTitle !== "" &&
		unit.trim() !== "" &&
		targetValue !== null &&
		targetValue > 0 &&
		startDate !== undefined;

	function submit(event: FormEvent) {
		event.preventDefault();
		if (!isValid || targetValue === null || startDate === undefined) return;

		onSubmit({
			title: trimmedTitle,
			type,
			unit: unit.trim(),
			targetValue,
			startDate,
			deadline: deadline ?? null,
			description: description.trim(),
			coverUrl: coverUrl.trim() === "" ? null : coverUrl.trim(),
			author: author.trim(),
		});
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={tracker ? "Edit tracker" : "New tracker"}
			onSubmit={submit}
			actions={(formId) => (
				<HStack gap={2} hAlign="end">
					<Button
						label="Cancel"
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label={tracker ? "Save changes" : "Create tracker"}
						variant="primary"
						type="submit"
						form={formId}
						isDisabled={!isValid}
					/>
				</HStack>
			)}
		>
			<VStack gap={4}>
				<TextInput
					label="Title"
					isRequired
					value={title}
					onChange={setTitle}
					placeholder="Dune"
				/>

				<Selector
					label="Type"
					options={TYPE_OPTIONS}
					value={type}
					onChange={changeType}
				/>

				<FieldRow>
					<TextInput
						label="Unit"
						isRequired
						value={unit}
						onChange={setUnit}
						placeholder="pages"
					/>
					<NumberInput
						label="Target"
						isRequired
						min={1}
						value={targetValue}
						onChange={setTargetValue}
						placeholder="412"
					/>
				</FieldRow>

				{type === "book" ? (
					<TextInput
						label="Author"
						isOptional
						value={author}
						onChange={setAuthor}
						placeholder="Frank Herbert"
					/>
				) : null}

				<TextInput
					label="Cover image URL"
					isOptional
					value={coverUrl}
					onChange={setCoverUrl}
					placeholder="https://…"
				/>

				<ScheduleFields
					startDate={startDate}
					deadline={deadline}
					onStartDateChange={setStartDate}
					onDeadlineChange={setDeadline}
				/>

				<TextArea
					label="Description"
					isOptional
					rows={2}
					value={description}
					onChange={setDescription}
				/>
			</VStack>
		</FormDialog>
	);
}
