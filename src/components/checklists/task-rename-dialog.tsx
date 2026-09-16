import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Check, X } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { TagTextField } from "#/components/tags/tag-text-field";
import { type ParsedTitle, parseInlineTags } from "#/lib/tags/inline-tags";
import { useTaskTypes } from "#/lib/use-task-types";
import type { Tag } from "#/schemas/tag";
import type { Task } from "#/schemas/task";
import type { TaskType } from "#/schemas/task-type";
import { taskFieldRows } from "./quick-add-task";
import { type NotesView, TaskNotesField } from "./task-notes-field";

/** The type field's value for a task with none. */
const NO_TYPE = "none";

/**
 * The optional fields only this dialog writes — empty means none — and a
 * priority typed at the end of the title, which turns its flag on; see
 * `readPriority`. The flags are left out when none was typed, so saving never
 * turns one off.
 */
export type TaskDetails = {
	caption: string;
	notes: string;
	/** What kind of work it is, or `null` for none; see `TaskType`. */
	typeId: string | null;
	urgent?: boolean;
	important?: boolean;
};

/**
 * Edit a task.
 *
 * Title and tags are one field, because they are one thing the user typed. The
 * tags are already in the text, so changing them is editing the sentence rather
 * than hunting for a separate control.
 *
 * It is the same text area the task was written in, sized the same way, so a
 * long title can be read and edited whole rather than scrolled along one line.
 * When adding, a line break starts the next task; here there is only the one
 * task, so a break is folded back into a space.
 *
 * The caption and the notes are written here and nowhere else. Adding a task
 * stays one line of typing; these are for a second look at it.
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
	onSubmit: (parsed: ParsedTitle, details: TaskDetails) => void;
}) {
	const [value, setValue] = useState("");
	const [caption, setCaption] = useState("");
	const captionRef = useRef<HTMLInputElement>(null);
	const [notes, setNotes] = useState("");
	const [typeId, setTypeId] = useState(NO_TYPE);
	const [notesView, setNotesView] = useState<NotesView>("write");
	const types = useTaskTypes();

	useEffect(() => {
		if (!isOpen || !task) return;
		// The title already holds its tags, exactly where they were typed.
		setValue(task.title);
		setCaption(task.caption ?? "");
		setNotes(task.notes ?? "");
		setTypeId(task.typeId ?? NO_TYPE);
		// Notes are only ever shown here, so ones that exist open ready to read.
		setNotesView(task.notes ? "preview" : "write");
	}, [isOpen, task]);

	/*
	 * A caption is a line about the task, not a name or an address. Without
	 * this, a phone offered saved passwords and addresses over the keyboard the
	 * moment the field was tapped. Set on the element itself, which is where
	 * autofill reads it, as the title field does; see `TagTextField`.
	 */
	useEffect(() => {
		captionRef.current?.setAttribute("autocomplete", "off");
	}, []);

	const parsed = parseInlineTags(value.replace(/\s*\n\s*/g, " "));

	function save() {
		if (parsed.title === "") return;
		onSubmit(parsed, {
			caption: caption.trim(),
			notes: notes.trim(),
			typeId: typeId === NO_TYPE ? null : typeId,
			...(parsed.urgent ? { urgent: true } : {}),
			...(parsed.important ? { important: true } : {}),
		});
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
						icon={<X aria-hidden />}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label="Save"
						icon={<Check aria-hidden />}
						variant="primary"
						isDisabled={parsed.title === ""}
						onClick={save}
					/>
				</HStack>
			)}
		>
			<VStack gap={4}>
				<VStack gap={1}>
					<TagTextField
						label="Title"
						value={value}
						onChange={setValue}
						onSubmit={save}
						tags={tags}
						multiline
						rows={taskFieldRows(value)}
						hasAutoFocus
					/>
					<Text type="supporting">
						Write tags inline, like #shopping. Removing one here takes it off
						the task. End with -u, -i or -ui to flag it.
					</Text>
				</VStack>

				{/* A type the list no longer has still reads as none, not as blank. */}
				{types.length === 0 && typeId === NO_TYPE ? null : (
					<TypeField types={types} value={typeId} onChange={setTypeId} />
				)}

				<TextInput
					ref={captionRef}
					label="Caption"
					isOptional
					description="Shown in small text under the title."
					value={caption}
					onChange={setCaption}
					// Enter saves here too, as it does in the title.
					onKeyDown={(event) => {
						if (event.key === "Enter") save();
					}}
					width="100%"
				/>

				<TaskNotesField
					value={notes}
					onChange={setNotes}
					view={notesView}
					onViewChange={setNotesView}
				/>
			</VStack>
		</FormDialog>
	);
}

/**
 * What kind of work the task is. Memoised: the Selector is the costliest part
 * of this dialog to draw, and nothing it shows changes as the title is typed.
 */
const TypeField = memo(function TypeField({
	types,
	value,
	onChange,
}: {
	types: ReadonlyArray<TaskType>;
	value: string;
	onChange: (typeId: string) => void;
}) {
	return (
		<Selector
			label="Type"
			isOptional
			options={[
				{ value: NO_TYPE, label: "No type" },
				...types.map((type) => ({ value: type.typeId, label: type.name })),
			]}
			value={types.some((type) => type.typeId === value) ? value : NO_TYPE}
			onChange={onChange}
		/>
	);
});
