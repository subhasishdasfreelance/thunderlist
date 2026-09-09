import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { DateInput } from "@astryxdesign/core/DateInput";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { type FormEvent, useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import type { EntryValues } from "#/lib/changes";
import { formatDate } from "#/lib/format-date";
import { todayDateOnly } from "#/schemas/common";
import type { ProgressEntry, Tracker } from "#/schemas/tracker";

/**
 * Record where you have got to.
 *
 * You always enter the reading, never the increment: after reading to page 78
 * you type 78, not 33. The step is worked out from the reading before it and
 * shown here as you type, so what gets stored is never a surprise.
 */
export function EntryFormDialog({
	isOpen,
	onOpenChange,
	tracker,
	entry,
	previousValue,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	tracker: Tracker;
	entry?: ProgressEntry;
	/** The reading this one follows, which the step is measured from. */
	previousValue: number;
	onSubmit: (values: EntryValues) => void;
}) {
	const [value, setValue] = useState<number | null>(null);
	const [recordedAt, setRecordedAt] = useState<ISODateString | undefined>(
		undefined,
	);
	const [note, setNote] = useState("");

	useEffect(() => {
		if (!isOpen) return;
		setValue(entry?.value ?? tracker.currentValue);
		setRecordedAt(
			(entry?.recordedAt as ISODateString | undefined) ??
				(todayDateOnly() as ISODateString),
		);
		setNote(entry?.note ?? "");
	}, [isOpen, entry, tracker.currentValue]);

	const valueLabel =
		tracker.type === "book"
			? "Current page"
			: `Where you are now (${tracker.unit})`;

	const isValid = value !== null && value >= 0 && recordedAt !== undefined;
	const delta = value === null ? null : value - previousValue;

	/*
	 * A reading identical to the one before it records nothing, so there is
	 * nothing to save and the button says so by being off.
	 *
	 * Editing is the exception. An entry already stored at that value is a fact
	 * about the past, and its note or its date can still be wrong — so a change
	 * to either is worth saving even when the reading has not moved.
	 */
	const isCorrection =
		entry !== undefined &&
		(note.trim() !== entry.note || recordedAt !== entry.recordedAt);
	const hasSomethingToSave = delta !== 0 || isCorrection;

	function submit(event: FormEvent) {
		event.preventDefault();
		if (!isValid || !hasSomethingToSave) return;
		if (value === null || recordedAt === undefined) return;

		onSubmit({ value, recordedAt, note: note.trim() });
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={entry ? "Edit progress" : "Add progress"}
			subtitle={`${tracker.title} · target ${tracker.targetValue} ${tracker.unit}`}
			width={420}
			onSubmit={submit}
			actions={(formId) => (
				<HStack gap={2} hAlign="end">
					<Button
						label="Cancel"
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label="Save"
						variant="primary"
						type="submit"
						form={formId}
						isDisabled={!isValid || !hasSomethingToSave}
					/>
				</HStack>
			)}
		>
			<VStack gap={4}>
				<NumberInput
					label={valueLabel}
					isRequired
					description={`You were at ${previousValue} ${tracker.unit}.`}
					min={0}
					value={value}
					onChange={setValue}
				/>

				{delta === null ? null : (
					<Text type="supporting">
						{delta === 0
							? hasSomethingToSave
								? "No change since the last reading."
								: "No change since the last reading — nothing to save."
							: delta > 0
								? `That records +${delta} ${tracker.unit}.`
								: `That records ${delta} ${tracker.unit}, going backwards.`}
					</Text>
				)}

				<DateInput
					label="Date"
					isRequired
					description="Set it back to log a day you missed."
					format={formatDate}
					value={recordedAt}
					onChange={setRecordedAt}
				/>
				<TextArea
					label="Note"
					isOptional
					rows={2}
					value={note}
					onChange={setNote}
					placeholder="Finished chapter 7"
				/>
			</VStack>
		</FormDialog>
	);
}
