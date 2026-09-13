import type { ISODateString } from "@astryxdesign/core/Calendar";
import { DateInput } from "@astryxdesign/core/DateInput";
import { VStack } from "@astryxdesign/core/Stack";
import { Switch } from "@astryxdesign/core/Switch";
import { type ISOTimeString, TimeInput } from "@astryxdesign/core/TimeInput";
import { FieldRow } from "#/components/common/field-row";
import { formatDate } from "#/lib/format-date";
import { type DailyWindow, DEFAULT_DAILY_WINDOW } from "#/schemas/common";

/**
 * The schedule every pace figure is measured against, shared by the checklist,
 * tracker and tag forms.
 *
 * Start date is required and pre-filled with today, but editable, so something
 * begun last month is paced from when it really began rather than from when it
 * was typed in. The deadline can carry a time as well as a day — due at six,
 * not just due on Friday — and pace is then measured right up to it, in
 * fractions of an hour.
 *
 * Where `onDailyWindowChange` is given, the schedule can repeat daily instead:
 * the same hours every day, morning to night to begin with, and pace is judged
 * against today's stretch of them. That takes the deadline's place rather than
 * sitting beside it, since the two would be two answers to one question.
 */
export function ScheduleFields({
	startDate,
	deadline,
	deadlineTime,
	dailyWindow = null,
	onStartDateChange,
	onDeadlineChange,
	onDeadlineTimeChange,
	onDailyWindowChange,
	isStartDateOptional = false,
}: {
	startDate: ISODateString | undefined;
	deadline: ISODateString | undefined;
	/** `HH:MM`, or `undefined` for the start of the deadline day. */
	deadlineTime: string | undefined;
	dailyWindow?: DailyWindow | null;
	onStartDateChange: (value: ISODateString | undefined) => void;
	onDeadlineChange: (value: ISODateString | undefined) => void;
	onDeadlineTimeChange: (value: string | undefined) => void;
	/**
	 * Offers "Repeats daily" when given. A tracker counts towards one total, so
	 * it is not offered one.
	 */
	onDailyWindowChange?: (value: DailyWindow | null) => void;
	/**
	 * A tag's start date may be left empty, and is then counted from the day the
	 * tag was made.
	 */
	isStartDateOptional?: boolean;
}) {
	const isWindowBackwards =
		dailyWindow !== null && dailyWindow.to <= dailyWindow.from;

	return (
		<VStack gap={3}>
			<FieldRow>
				<DateInput
					label="Start date"
					isRequired={!isStartDateOptional}
					isOptional={isStartDateOptional}
					description={
						isStartDateOptional
							? "Leave empty to count from the day it was made."
							: "Set it back to log work you have already done."
					}
					format={formatDate}
					value={startDate}
					onChange={onStartDateChange}
				/>
				{dailyWindow !== null ? null : (
					<VStack gap={2}>
						<DateInput
							label="Deadline"
							isOptional
							description="Used to work out whether you are ahead or behind."
							format={formatDate}
							value={deadline}
							onChange={onDeadlineChange}
						/>
						{deadline === undefined ? null : (
							<TimeInput
								label="Due by"
								isOptional
								hasClear
								description="Leave empty for the start of the day."
								value={deadlineTime as ISOTimeString | undefined}
								onChange={onDeadlineTimeChange}
							/>
						)}
					</VStack>
				)}
			</FieldRow>

			{onDailyWindowChange === undefined ? null : (
				<VStack gap={2}>
					<Switch
						label="Repeats daily"
						description="Paced against the same hours every day, instead of a deadline."
						value={dailyWindow !== null}
						onChange={(isOn) =>
							onDailyWindowChange(isOn ? DEFAULT_DAILY_WINDOW : null)
						}
					/>
					{dailyWindow === null ? null : (
						<FieldRow>
							<TimeInput
								label="From"
								isRequired
								value={dailyWindow.from as ISOTimeString}
								onChange={(from) => {
									if (from) onDailyWindowChange({ ...dailyWindow, from });
								}}
							/>
							<TimeInput
								label="To"
								isRequired
								value={dailyWindow.to as ISOTimeString}
								onChange={(to) => {
									if (to) onDailyWindowChange({ ...dailyWindow, to });
								}}
								status={
									isWindowBackwards
										? {
												type: "error",
												message: "It has to end after it starts.",
											}
										: undefined
								}
							/>
						</FieldRow>
					)}
				</VStack>
			)}
		</VStack>
	);
}
