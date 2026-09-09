import type { ISODateString } from "@astryxdesign/core/Calendar";
import { DateInput } from "@astryxdesign/core/DateInput";
import { HStack } from "@astryxdesign/core/Stack";
import { formatDate } from "#/lib/format-date";

/**
 * The start date and deadline pair, shared by the checklist and tracker forms.
 *
 * Start date is required and pre-filled with today, but editable, so something
 * begun last month is paced from when it really began rather than from when it
 * was typed in. Together the two describe the window every pace figure in the
 * app is measured against, which is why they are entered side by side.
 */
export function ScheduleFields({
	startDate,
	deadline,
	onStartDateChange,
	onDeadlineChange,
}: {
	startDate: ISODateString | undefined;
	deadline: ISODateString | undefined;
	onStartDateChange: (value: ISODateString | undefined) => void;
	onDeadlineChange: (value: ISODateString | undefined) => void;
}) {
	return (
		<HStack gap={3}>
			<DateInput
				label="Start date"
				isRequired
				description="Set it back to log work you have already done."
				format={formatDate}
				value={startDate}
				onChange={onStartDateChange}
			/>
			<DateInput
				label="Deadline"
				isOptional
				description="Used to work out whether you are ahead or behind."
				format={formatDate}
				value={deadline}
				onChange={onDeadlineChange}
			/>
		</HStack>
	);
}
