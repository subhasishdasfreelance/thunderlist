import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Check, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { FieldRow } from "#/components/common/field-row";
import { FormDialog } from "#/components/common/form-dialog";
import { ScheduleFields } from "#/components/common/schedule-fields";
import type { TrackerValues } from "#/lib/changes";
import { todayDateOnly } from "#/schemas/common";
import { TRACKER_TYPE_DEFAULT_UNITS, type Tracker } from "#/schemas/tracker";

/**
 * Create or edit a tracker.
 *
 * There is no type to pick: the unit already says what is being counted, so a
 * new tracker is saved as "custom". One that already has a type keeps it — an
 * existing book still shows its author field and cannot pass its last page.
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
	const [unit, setUnit] = useState("pages");
	const [startValue, setStartValue] = useState<number | null>(null);
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
		setUnit(tracker?.unit ?? TRACKER_TYPE_DEFAULT_UNITS.book);
		setStartValue(tracker?.startValue ?? 0);
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

	const trimmedTitle = title.trim();
	const from = startValue ?? 0;

	/*
	 * The target has to be past the starting point, or there is no distance to
	 * cover: "page 40 to page 40" is not a plan, and every pace figure derived
	 * from it would be a division by zero.
	 */
	const isValid =
		trimmedTitle !== "" &&
		unit.trim() !== "" &&
		targetValue !== null &&
		targetValue > from &&
		startDate !== undefined;

	function submit(event: FormEvent) {
		event.preventDefault();
		if (!isValid || targetValue === null || startDate === undefined) return;

		onSubmit({
			title: trimmedTitle,
			type: tracker?.type ?? "custom",
			unit: unit.trim(),
			targetValue,
			startValue: from,
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
						icon={<X aria-hidden />}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label={tracker ? "Save changes" : "Create tracker"}
						icon={<Check aria-hidden />}
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

				<NumberInput
					label="Starting from"
					isOptional
					description="Where you already are. Leave at 0 to start from scratch."
					min={0}
					value={startValue}
					onChange={setStartValue}
					placeholder="0"
				/>

				{tracker?.type === "book" ? (
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
					rows={4}
					value={description}
					onChange={setDescription}
				/>
			</VStack>
		</FormDialog>
	);
}
