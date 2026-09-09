import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { type FormEvent, useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { ScheduleFields } from "#/components/common/schedule-fields";
import type { ChecklistValues } from "#/lib/pending/actions";
import type { Checklist } from "#/schemas/checklist";
import { todayDateOnly } from "#/schemas/common";

/**
 * Create or edit a checklist.
 *
 * The same dialog serves both: `checklist` seeds the fields when editing and is
 * absent when creating, where the start date defaults to today.
 */
export function ChecklistFormDialog({
	isOpen,
	onOpenChange,
	checklist,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	checklist?: Checklist;
	onSubmit: (values: ChecklistValues) => void;
}) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [startDate, setStartDate] = useState<ISODateString | undefined>(
		undefined,
	);
	const [deadline, setDeadline] = useState<ISODateString | undefined>(
		undefined,
	);

	// Reset to the current values every time the dialog opens.
	useEffect(() => {
		if (!isOpen) return;
		setTitle(checklist?.title ?? "");
		setDescription(checklist?.description ?? "");
		setStartDate(
			(checklist?.startDate as ISODateString | undefined) ??
				(todayDateOnly() as ISODateString),
		);
		setDeadline((checklist?.deadline as ISODateString | null) ?? undefined);
	}, [isOpen, checklist]);

	const trimmedTitle = title.trim();
	const isValid = trimmedTitle !== "" && startDate !== undefined;

	function submit(event: FormEvent) {
		event.preventDefault();
		if (!isValid || startDate === undefined) return;

		onSubmit({
			title: trimmedTitle,
			description: description.trim(),
			startDate,
			deadline: deadline ?? null,
		});
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={checklist ? "Edit checklist" : "New checklist"}
			onSubmit={submit}
			actions={(formId) => (
				<HStack gap={2} hAlign="end">
					<Button
						label="Cancel"
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label={checklist ? "Save changes" : "Create checklist"}
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
					placeholder="Product Launch Q3"
				/>
				<TextArea
					label="Description"
					isOptional
					rows={2}
					value={description}
					onChange={setDescription}
					placeholder="What this checklist covers"
				/>
				<ScheduleFields
					startDate={startDate}
					deadline={deadline}
					onStartDateChange={setStartDate}
					onDeadlineChange={setDeadline}
				/>
			</VStack>
		</FormDialog>
	);
}
