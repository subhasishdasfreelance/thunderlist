import { Button } from "@astryxdesign/core/Button";
import type { ISODateString } from "@astryxdesign/core/Calendar";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Check, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FieldRow } from "#/components/common/field-row";
import { FormDialog } from "#/components/common/form-dialog";
import { TextInput } from "#/components/common/text-fields";
import { TimeField } from "#/components/common/time-field";
import { STAGE_COLOR_OPTIONS } from "#/components/tags/tag-form-dialog";
import { AccessField, useOwnAlone } from "#/components/teams/access-field";
import { formatDate } from "#/lib/format-date";
import type { AccessEntry } from "#/schemas/access";
import {
	COUNTDOWN_FORMAT_LABELS,
	COUNTDOWN_FORMATS,
	type Countdown,
	type CountdownFormat,
} from "#/schemas/countdown";
import { pickableColor, type TagColor } from "#/schemas/tag";

export type CountdownValues = {
	title: string;
	date: string;
	/** `HH:MM`, or `null` for the start of the day. */
	time: string | null;
	color: TagColor;
	format: CountdownFormat;
	/** Who may do what with it, or `null` for the whole team. */
	access: Array<AccessEntry> | null;
};

const FORMAT_OPTIONS = COUNTDOWN_FORMATS.map((format) => ({
	value: format,
	label: COUNTDOWN_FORMAT_LABELS[format],
}));

/**
 * Make or edit a countdown: what it is, the day and time, its colour and how
 * the time left is shown. The day and its time are two fields, as everywhere;
 * see `ScheduleFields`. Editing one, it can be deleted from here too.
 */
export function CountdownFormDialog({
	isOpen,
	onOpenChange,
	countdown,
	onSubmit,
	onDelete,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** The countdown being edited; absent for a new one. */
	countdown?: Countdown;
	onSubmit: (values: CountdownValues) => void;
	onDelete?: () => void;
}) {
	const [title, setTitle] = useState("");
	const [date, setDate] = useState<ISODateString | undefined>(undefined);
	const [time, setTime] = useState<string | undefined>(undefined);
	const [color, setColor] = useState<TagColor>("blue");
	const [format, setFormat] = useState<CountdownFormat>("seconds");
	// A new one starts with its author alone on it; see `AccessField`.
	const ownAlone = useOwnAlone();
	const [access, setAccess] = useState<Array<AccessEntry> | null>(null);

	useEffect(() => {
		if (!isOpen) return;
		setTitle(countdown?.title ?? "");
		setDate((countdown?.date as ISODateString | undefined) ?? undefined);
		setTime(countdown?.time ?? undefined);
		setColor(countdown?.color ?? "blue");
		setFormat(countdown?.format ?? "seconds");
		setAccess(countdown === undefined ? ownAlone : (countdown.access ?? null));
	}, [isOpen, countdown, ownAlone]);

	const trimmed = title.trim();
	const isValid = trimmed !== "" && date !== undefined;

	function save() {
		if (!isValid || date === undefined) return;
		onSubmit({
			title: trimmed,
			date,
			time: time ?? null,
			color,
			format,
			access,
		});
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			number={{ kind: "countdown", number: countdown?.number }}
			title={countdown ? "Edit countdown" : "New countdown"}
			width={440}
			actions={() => (
				<HStack gap={2} hAlign="between">
					{onDelete === undefined ? (
						<span />
					) : (
						<Button
							label="Delete"
							icon={<Trash2 aria-hidden />}
							variant="ghost"
							onClick={onDelete}
						/>
					)}
					<HStack gap={2}>
						<Button
							label="Cancel"
							icon={<X aria-hidden />}
							variant="ghost"
							onClick={() => onOpenChange(false)}
						/>
						<Button
							label={countdown ? "Save changes" : "Start countdown"}
							icon={<Check aria-hidden />}
							variant="primary"
							isDisabled={!isValid}
							onClick={save}
						/>
					</HStack>
				</HStack>
			)}
		>
			<VStack gap={4}>
				<TextInput
					autoComplete="off"
					label="What for"
					isRequired
					value={title}
					onChange={setTitle}
					onEnter={save}
					placeholder="Product launch"
				/>
				<FieldRow>
					<DateInput
						label="Day"
						isRequired
						format={formatDate}
						value={date}
						onChange={setDate}
					/>
					<TimeField
						label="Time"
						isOptional
						hasClear
						description="Leave empty to count to the start of the day."
						value={time}
						onChange={setTime}
					/>
				</FieldRow>
				<Selector
					label="Colour"
					options={STAGE_COLOR_OPTIONS}
					value={pickableColor(color)}
					onChange={(next) => setColor(next as TagColor)}
				/>
				<Selector
					label="Show as"
					options={FORMAT_OPTIONS}
					value={format}
					onChange={(next) => setFormat(next as CountdownFormat)}
				/>
				<AccessField noun="countdown" value={access} onChange={setAccess} />
			</VStack>
		</FormDialog>
	);
}
