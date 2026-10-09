import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FieldRow } from "#/components/common/field-row";
import { FormDialog } from "#/components/common/form-dialog";
import { TextArea } from "#/components/common/text-fields";
import { TimeField } from "#/components/common/time-field";
import { formatDate } from "#/lib/format-date";
import { useTaskTypes } from "#/lib/use-task-types";
import type { Task, TaskPatch } from "#/schemas/task";

/** What can be set on many tasks at once; see `TasksEditDialog`. */
export type TasksEdit = Pick<
	TaskPatch,
	"typeId" | "caption" | "deadline" | "deadlineTime" | "urgent" | "important"
>;

/** The type field's value for no type, and for leaving each its own. */
const NO_TYPE = "none";
const AS_THEY_ARE = "as-they-are";

/** The value every task has for one field, or `null` where they differ. */
function shared<T>(
	tasks: ReadonlyArray<Task>,
	read: (task: Task) => T,
): { value: T } | null {
	const first = read(tasks[0]);
	return tasks.every((task) => read(task) === first) ? { value: first } : null;
}

type Fields = {
	typeId: string;
	caption: string;
	deadline: ISODateString | undefined;
	/** `HH:MM`, or `undefined` for the day as a whole. */
	deadlineTime: string | undefined;
	urgent: boolean | "indeterminate";
	important: boolean | "indeterminate";
};

/** What the fields open on: what the tasks share, and where they differ, so. */
function fieldsOf(tasks: ReadonlyArray<Task>): Fields {
	const typeId = shared(tasks, (task) => task.typeId ?? null);
	const urgent = shared(tasks, (task) => task.urgent);
	const important = shared(tasks, (task) => task.important);

	return {
		typeId: typeId === null ? AS_THEY_ARE : (typeId.value ?? NO_TYPE),
		caption: shared(tasks, (task) => task.caption ?? "")?.value ?? "",
		deadline: (shared(tasks, (task) => task.deadline ?? null)?.value ??
			undefined) as ISODateString | undefined,
		deadlineTime:
			shared(tasks, (task) => task.deadlineTime ?? null)?.value ?? undefined,
		urgent: urgent?.value ?? "indeterminate",
		important: important?.value ?? "indeterminate",
	};
}

/**
 * Edit every task picked out at once — E, or Edit in the bar over a pick.
 *
 * Only what several tasks can sensibly share is here: their type, caption,
 * deadline and flags. A title, notes and subtasks are each task's own, and
 * are edited one task at a time.
 *
 * Each field opens on what the tasks have in common. Where they differ it
 * says so, and is left that way unless it is changed: only the fields
 * touched are saved, onto every task, as one change; see `updateAllAlike`.
 */
export function TasksEditDialog({
	isOpen,
	onOpenChange,
	tasks,
	onSave,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** The tasks being edited, or `null` while none are. */
	tasks: ReadonlyArray<Task> | null;
	onSave: (edit: TasksEdit) => void;
}) {
	const types = useTaskTypes();
	const [fields, setFields] = useState<Fields | null>(null);
	const [touched, setTouched] = useState<ReadonlySet<keyof Fields>>(new Set());

	// Afresh every time it opens.
	useEffect(() => {
		if (!isOpen || tasks === null || tasks.length === 0) return;
		setFields(fieldsOf(tasks));
		setTouched(new Set());
	}, [isOpen, tasks]);

	// Which fields the tasks have each their own of, to say so.
	const differs =
		tasks === null || tasks.length === 0
			? null
			: {
					typeId: shared(tasks, (task) => task.typeId ?? null) === null,
					caption: shared(tasks, (task) => task.caption ?? "") === null,
					deadline: shared(tasks, (task) => task.deadline ?? null) === null,
					deadlineTime:
						shared(tasks, (task) => task.deadlineTime ?? null) === null,
				};

	function change<K extends keyof Fields>(key: K, value: Fields[K]) {
		setFields((current) =>
			current === null ? null : { ...current, [key]: value },
		);
		setTouched((current) => new Set(current).add(key));
	}

	function save() {
		if (fields === null || touched.size === 0) return;

		const edit: TasksEdit = {};
		if (touched.has("typeId") && fields.typeId !== AS_THEY_ARE) {
			edit.typeId = fields.typeId === NO_TYPE ? null : fields.typeId;
		}
		if (touched.has("caption")) {
			// One line, however it was typed or pasted, as for one task.
			edit.caption = fields.caption.replace(/\s*\n\s*/g, " ").trim();
		}
		if (touched.has("deadline")) edit.deadline = fields.deadline ?? null;
		if (touched.has("deadlineTime")) {
			edit.deadlineTime = fields.deadlineTime ?? null;
		}
		if (touched.has("urgent") && fields.urgent !== "indeterminate") {
			edit.urgent = fields.urgent;
		}
		if (touched.has("important") && fields.important !== "indeterminate") {
			edit.important = fields.important;
		}
		onSave(edit);
	}

	const count = tasks?.length ?? 0;

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={`Edit ${count} tasks`}
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
						isDisabled={touched.size === 0}
						onClick={save}
					/>
				</HStack>
			)}
		>
			{fields === null ? null : (
				<VStack gap={4}>
					{types.length === 0 && fields.typeId === NO_TYPE ? null : (
						<Selector
							label="Type"
							isOptional
							options={[
								...(differs?.typeId
									? [{ value: AS_THEY_ARE, label: "Each as it is" }]
									: []),
								{ value: NO_TYPE, label: "No type" },
								...types.map((type) => ({
									value: type.typeId,
									label: type.name,
								})),
							]}
							value={fields.typeId}
							onChange={(value) => change("typeId", value)}
						/>
					)}

					<TextArea
						autoComplete="off"
						label="Caption"
						isOptional
						description={
							differs?.caption
								? "Each has its own. What is written here replaces them all."
								: "Shown in small text under the title."
						}
						rows={2}
						value={fields.caption}
						onChange={(value) => change("caption", value)}
						// Enter saves here, as it does when editing one task.
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								save();
							}
						}}
						width="100%"
					/>

					{/* The time beside its day, disabled until there is one. */}
					<FieldRow>
						<DateInput
							label="Deadline"
							isOptional
							hasClear
							description={
								differs?.deadline
									? "Each has its own. A day picked here goes on them all."
									: "Shown on the task as how long is left."
							}
							format={formatDate}
							value={fields.deadline}
							onChange={(value) => {
								change("deadline", value);
								// Clearing the day clears the hour with it.
								if (value === undefined) change("deadlineTime", undefined);
							}}
						/>
						<TimeField
							label="Due at"
							isOptional
							hasClear
							description={
								differs?.deadlineTime
									? "Each has its own. A time picked here goes on them all."
									: "Leave empty and they are due that whole day."
							}
							isDisabled={fields.deadline === undefined}
							disabledMessage="Pick a deadline first."
							value={fields.deadlineTime}
							onChange={(value) => change("deadlineTime", value)}
						/>
					</FieldRow>

					<HStack gap={4}>
						<CheckboxInput
							label="Urgent"
							value={fields.urgent}
							onChange={(isOn) => change("urgent", isOn)}
						/>
						<CheckboxInput
							label="Important"
							value={fields.important}
							onChange={(isOn) => change("important", isOn)}
						/>
					</HStack>
				</VStack>
			)}
		</FormDialog>
	);
}
