import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Check, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { ScheduleFields } from "#/components/common/schedule-fields";
import {
	draftTagIds,
	EMPTY_TAGS_DRAFT,
	TagsField,
	tagsDraft,
} from "#/components/tags/tags-field";
import type { ChecklistValues } from "#/lib/changes";
import type { Checklist } from "#/schemas/checklist";
import { type DailyWindow, todayDateOnly } from "#/schemas/common";
import type { Tag } from "#/schemas/tag";

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
	tags,
	resolveTags,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	checklist?: Checklist;
	/** Every tag that exists, for the tags field. */
	tags: ReadonlyArray<Tag>;
	/** Tag names to ids, making a tag for any name that does not exist yet. */
	resolveTags: (names: Array<string>) => Array<string>;
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
	const [deadlineTime, setDeadlineTime] = useState<string | undefined>(
		undefined,
	);
	const [dailyWindow, setDailyWindow] = useState<DailyWindow | null>(null);
	const [tagDraft, setTagDraft] = useState(EMPTY_TAGS_DRAFT);

	// Reset to the current values every time the dialog opens.
	// biome-ignore lint/correctness/useExhaustiveDependencies: the tags are read as the dialog opens and not followed after, or a list still loading would reset what is being typed on every render. A tag they cannot name yet is kept, not lost.
	useEffect(() => {
		if (!isOpen) return;
		setTitle(checklist?.title ?? "");
		setDescription(checklist?.description ?? "");
		setStartDate(
			(checklist?.startDate as ISODateString | undefined) ??
				(todayDateOnly() as ISODateString),
		);
		setDeadline((checklist?.deadline as ISODateString | null) ?? undefined);
		setDeadlineTime(checklist?.deadlineTime ?? undefined);
		setDailyWindow(checklist?.dailyWindow ?? null);
		setTagDraft(tagsDraft(checklist?.tagIds ?? [], tags));
	}, [isOpen, checklist]);

	const trimmedTitle = title.trim();
	const isValid =
		trimmedTitle !== "" &&
		startDate !== undefined &&
		(dailyWindow === null || dailyWindow.to > dailyWindow.from);

	function save() {
		if (!isValid || startDate === undefined) return;

		onSubmit({
			title: trimmedTitle,
			description: description.trim(),
			startDate,
			// Repeating daily takes the deadline's place; see `ScheduleFields`.
			deadline: dailyWindow === null ? (deadline ?? null) : null,
			deadlineTime:
				dailyWindow === null && deadline !== undefined
					? (deadlineTime ?? null)
					: null,
			dailyWindow,
			tagIds: draftTagIds(tagDraft, resolveTags),
		});
	}

	function submit(event: FormEvent) {
		event.preventDefault();
		save();
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
						icon={<X aria-hidden />}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label={checklist ? "Save changes" : "Create checklist"}
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
					placeholder="Product Launch Q3"
				/>
				<TextArea
					label="Description"
					isOptional
					rows={4}
					value={description}
					onChange={setDescription}
					placeholder="What this checklist covers"
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
				/>
				<TagsField
					label="Tags"
					description="Every task in this checklist carries these, done or not, and so will any added later."
					tags={tags}
					draft={tagDraft}
					onChange={setTagDraft}
					onSubmit={save}
				/>
			</VStack>
		</FormDialog>
	);
}
