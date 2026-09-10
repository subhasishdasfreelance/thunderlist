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
import { ScheduleFields } from "#/components/common/schedule-fields";
import type { TagValues } from "#/lib/changes";
import { TAG_COLORS, type Tag, type TagColor } from "#/schemas/tag";

const COLOR_OPTIONS = TAG_COLORS.map((color) => ({
	value: color,
	label: `${color.charAt(0).toUpperCase()}${color.slice(1)}`,
}));

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

	useEffect(() => {
		if (!isOpen) return;
		setName(tag?.name ?? "");
		setColor(tag?.color ?? "blue");
		setDescription(tag?.description ?? "");
		setStartDate((tag?.startDate as ISODateString | null) ?? undefined);
		setDeadline((tag?.deadline as ISODateString | null) ?? undefined);
	}, [isOpen, tag]);

	const trimmed = name.trim();
	const isDuplicate = existingNames.some(
		(existing) =>
			existing.toLowerCase() === trimmed.toLowerCase() &&
			existing.toLowerCase() !== tag?.name.toLowerCase(),
	);
	const isValid = trimmed !== "" && !isDuplicate;

	function save() {
		if (!isValid) return;
		onSubmit({
			name: trimmed,
			color,
			description: description.trim(),
			startDate: startDate ?? null,
			deadline: deadline ?? null,
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
							: undefined
					}
				/>

				<Selector
					label="Colour"
					options={COLOR_OPTIONS}
					value={color}
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
					onStartDateChange={setStartDate}
					onDeadlineChange={setDeadline}
					isStartDateOptional
				/>
			</VStack>
		</FormDialog>
	);
}
