import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { TextArea } from "@astryxdesign/core/TextArea";
import { useForm } from "@tanstack/react-form";
import { Check, X } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { DependsField } from "#/components/tasks/depends-field";
import { SubtasksField } from "#/components/tasks/subtasks-field";
import { formatDate } from "#/lib/format-date";
import { type ParsedTitle, parseInlineTags } from "#/lib/tags/inline-tags";
import { useTaskTypes } from "#/lib/use-task-types";
import type { ItemRef } from "#/schemas/common";
import type { Tag } from "#/schemas/tag";
import type { Subtask, Task } from "#/schemas/task";
import type { TaskType } from "#/schemas/task-type";
import { type NotesView, TaskNotesField } from "./task-notes-field";
import { TaskTitleField } from "./task-title-field";

/** The type field's value for a task with none. */
const NO_TYPE = "none";

/** What the fields open on: the task as it is, or blank while there is none. */
function fieldsOf(task: Task | null) {
	return {
		// The title already holds its tags, exactly where they were typed.
		title: task?.title ?? "",
		caption: task?.caption ?? "",
		notes: task?.notes ?? "",
		typeId: task?.typeId ?? NO_TYPE,
		dependsOn: task?.dependsOn ?? ([] as Array<ItemRef>),
		subtasks: task?.subtasks ?? ([] as Array<Subtask>),
		deadline: (task?.deadline ?? undefined) as ISODateString | undefined,
	};
}

/** The title as it will be saved: one line, its tags read out of it. */
function parseTitle(title: string): ParsedTitle {
	return parseInlineTags(title.replace(/\s*\n\s*/g, " "));
}

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
	/** Only when it changed; see `Task.dependsOn`. */
	dependsOn?: Array<ItemRef>;
	/** Only when they changed; see `Task.subtasks`. */
	subtasks?: Array<Subtask>;
	/** Only when it changed; `null` takes it off. See `Task.deadline`. */
	deadline?: string | null;
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
	const [notesView, setNotesView] = useState<NotesView>("write");
	const types = useTaskTypes();

	/*
	 * The fields live in a form rather than in this component's state, so a
	 * keystroke draws the field being typed in and nothing else: not the
	 * dialog around it, its buttons, or the other fields. Held here, every
	 * letter drew the whole dialog again, and on a phone that was felt.
	 */
	const form = useForm({
		defaultValues: fieldsOf(task),
		onSubmit: ({ value }) => {
			const parsed = parseTitle(value.title);
			if (parsed.title === "") return;
			// A row left with no title is dropped; see `SubtasksField`.
			const subtasks = value.subtasks.flatMap((subtask) => {
				const title = subtask.title.trim();
				return title === "" ? [] : [{ ...subtask, title }];
			});
			onSubmit(parsed, {
				// One line, however it was typed or pasted; see the field below.
				caption: value.caption.replace(/\s*\n\s*/g, " ").trim(),
				notes: value.notes.trim(),
				typeId: value.typeId === NO_TYPE ? null : value.typeId,
				...(JSON.stringify(value.dependsOn) ===
				JSON.stringify(task?.dependsOn ?? [])
					? {}
					: { dependsOn: value.dependsOn }),
				...(JSON.stringify(subtasks) === JSON.stringify(task?.subtasks ?? [])
					? {}
					: { subtasks }),
				...((value.deadline ?? null) === (task?.deadline ?? null)
					? {}
					: { deadline: value.deadline ?? null }),
				...(parsed.urgent ? { urgent: true } : {}),
				...(parsed.important ? { important: true } : {}),
			});
		},
	});

	useEffect(() => {
		if (!isOpen || !task) return;
		form.reset(fieldsOf(task));
		// Notes are only ever shown here, so ones that exist open ready to read.
		setNotesView(task.notes ? "preview" : "write");
	}, [isOpen, task, form]);

	function save() {
		void form.handleSubmit();
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			number={{ kind: "task", number: task?.number }}
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
					{/* Redrawn only when the title turns empty, or stops being. */}
					<form.Subscribe
						selector={(state) => parseTitle(state.values.title).title === ""}
					>
						{(isEmpty) => (
							<Button
								label="Save"
								icon={<Check aria-hidden />}
								variant="primary"
								isDisabled={isEmpty}
								onClick={save}
							/>
						)}
					</form.Subscribe>
				</HStack>
			)}
		>
			<VStack gap={4}>
				<form.Field name="title">
					{(field) => (
						<TaskTitleField
							label="Title"
							value={field.state.value}
							onChange={field.handleChange}
							onSubmit={save}
							tags={tags}
							hasAutoFocus
							hint="Write tags inline, like #shopping. Removing one here takes it off the task. End with -u, -i or -ui to flag it."
						/>
					)}
				</form.Field>

				<form.Field name="typeId">
					{(field) =>
						// A type the list no longer has still reads as none, not as blank.
						types.length === 0 && field.state.value === NO_TYPE ? null : (
							<TypeField
								types={types}
								value={field.state.value}
								onChange={field.handleChange}
							/>
						)
					}
				</form.Field>

				{/*
				 * A text area rather than a one-line input, and not for the room: a
				 * phone offers saved passwords and addresses over any text input it
				 * takes for part of a form, and `autocomplete="off"` does not stop
				 * it. Nothing offers to fill a text area, so the keyboard stays a
				 * keyboard. Whatever is typed is still one line when it is saved.
				 */}
				<form.Field name="caption">
					{(field) => (
						<TextArea
							autoComplete="off"
							label="Caption"
							isOptional
							description="Shown in small text under the title."
							rows={2}
							value={field.state.value}
							onChange={field.handleChange}
							// Enter saves here too, as it does in the title.
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									save();
								}
							}}
							width="100%"
						/>
					)}
				</form.Field>

				<form.Field name="deadline">
					{(field) => (
						<DeadlineField
							value={field.state.value}
							onChange={field.handleChange}
						/>
					)}
				</form.Field>

				<form.Field name="notes">
					{(field) => (
						<TaskNotesField
							value={field.state.value}
							onChange={field.handleChange}
							view={notesView}
							onViewChange={setNotesView}
						/>
					)}
				</form.Field>

				<form.Field name="subtasks">
					{(field) => (
						<SubtasksField
							value={field.state.value}
							onChange={field.handleChange}
						/>
					)}
				</form.Field>

				{task === null ? null : (
					<form.Field name="dependsOn">
						{(field) => (
							<DependsField
								task={task}
								value={field.state.value}
								onChange={field.handleChange}
							/>
						)}
					</form.Field>
				)}
			</VStack>
		</FormDialog>
	);
}

/**
 * The day the task is due. Memoised, as the schedule's date fields are: its
 * calendar stays mounted while closed; see `ScheduleFields`.
 */
const DeadlineField = memo(function DeadlineField({
	value,
	onChange,
}: {
	value: ISODateString | undefined;
	onChange: (value: ISODateString | undefined) => void;
}) {
	return (
		<DateInput
			label="Deadline"
			isOptional
			hasClear
			description="Shown on the task as how long is left."
			format={formatDate}
			value={value}
			onChange={onChange}
		/>
	);
});

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
