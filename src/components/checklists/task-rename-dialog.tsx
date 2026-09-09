import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { TagTextField } from "#/components/tags/tag-text-field";
import { type ParsedTitle, parseInlineTags } from "#/lib/tags/inline-tags";
import type { Tag } from "#/schemas/tag";
import type { Task } from "#/schemas/task";

/**
 * Edit a task.
 *
 * Title and tags are one field, because they are one thing the user typed. The
 * tags are already in the text, so changing them is editing the sentence rather
 * than hunting for a separate control.
 */
export function TaskRenameDialog({
	isOpen,
	onOpenChange,
	task,
	tags,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	task: Task | null;
	tags: ReadonlyArray<Tag>;
	onSubmit: (parsed: ParsedTitle) => void;
}) {
	const [value, setValue] = useState("");

	useEffect(() => {
		if (!isOpen || !task) return;
		// The title already holds its tags, exactly where they were typed.
		setValue(task.title);
	}, [isOpen, task]);

	const parsed = parseInlineTags(value);

	function save() {
		if (parsed.title === "") return;
		onSubmit(parsed);
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title="Edit task"
			width={420}
			actions={() => (
				<HStack gap={2} hAlign="end">
					<Button
						label="Cancel"
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label="Save"
						variant="primary"
						isDisabled={parsed.title === ""}
						onClick={save}
					/>
				</HStack>
			)}
		>
			<VStack gap={1}>
				<TagTextField
					label="Title"
					value={value}
					onChange={setValue}
					onSubmit={save}
					tags={tags}
					hasAutoFocus
				/>
				<Text type="supporting">
					Write tags inline, like #shopping. Removing one here takes it off the
					task.
				</Text>
			</VStack>
		</FormDialog>
	);
}
