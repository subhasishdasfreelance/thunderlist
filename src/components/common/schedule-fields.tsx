import type { ISODateString } from "@astryxdesign/core/Calendar";
import { DateInput } from "@astryxdesign/core/DateInput";
import { VStack } from "@astryxdesign/core/Stack";
import { Switch } from "@astryxdesign/core/Switch";
import { memo } from "react";
import { FieldRow } from "#/components/common/field-row";
import { TimeField } from "#/components/common/time-field";
import { formatDate } from "#/lib/format-date";
import { type DailyWindow, DEFAULT_DAILY_WINDOW } from "#/schemas/common";

/**
 * The schedule every pace figure is measured against, shared by the checklist,
 * tracker and tag forms.
 *
 * Start date is required and pre-filled with today, but editable, so something
 * begun last month is paced from when it really began rather than from when it
 * was typed in. Both it and the deadline can carry a time as well as a day —
 * started at nine, due at six, not just due on Friday — and pace is then
 * measured from and right up to them, in fractions of an hour.
 *
 * A day and a time are always two fields, here and everywhere else in the app:
 * one picker each, never a combined one. Two of them fit a phone, which a
 * combined field never did, and the same shape everywhere means the deadline is
 * filled in the way the daily hours below it already were.
 *
 * Times are picked the same way on every screen, from a list under the field
 * or typed into it; see `TimeField`.
 *
 * Every day has its time beside it, always shown so the form keeps one shape,
 * but disabled until there is a day for it to be on, since an hour with no date
 * is not an answer to anything. Clearing the day takes its time with it.
 *
 * Where `onDailyWindowChange` is given, the schedule can repeat daily instead:
 * the same hours every day, morning to night to begin with, and pace is judged
 * against today's stretch of them. That takes the deadline's place rather than
 * sitting beside it, since the two would be two answers to one question.
 *
 * Memoised. Each date field keeps its calendar mounted while closed — six weeks
 * of days, every one formatting its date on every render — so drawing this on
 * each keystroke anywhere in a form was most of what made typing lag. It is
 * drawn again only when the schedule itself changes.
 */
export const ScheduleFields = memo(function ScheduleFields({
	startDate,
	startTime,
	deadline,
	deadlineTime,
	dailyWindow = null,
	onStartDateChange,
	onStartTimeChange,
	onDeadlineChange,
	onDeadlineTimeChange,
	onDailyWindowChange,
	isStartDateOptional = false,
}: {
	startDate: ISODateString | undefined;
	/** `HH:MM`, or `undefined` for the start of the start day. */
	startTime: string | undefined;
	deadline: ISODateString | undefined;
	/** `HH:MM`, or `undefined` for the start of the deadline day. */
	deadlineTime: string | undefined;
	dailyWindow?: DailyWindow | null;
	onStartDateChange: (value: ISODateString | undefined) => void;
	onStartTimeChange: (value: string | undefined) => void;
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

	/** Clearing a day clears the hour with it; see above. */
	function changeStartDate(next: ISODateString | undefined) {
		onStartDateChange(next);
		if (next === undefined) onStartTimeChange(undefined);
	}

	function changeDeadline(next: ISODateString | undefined) {
		onDeadlineChange(next);
		if (next === undefined) onDeadlineTimeChange(undefined);
	}

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
					onChange={changeStartDate}
				/>
				<TimeField
					label="Start time"
					isOptional
					hasClear
					description="Leave empty and it starts at the start of that day."
					isDisabled={startDate === undefined}
					disabledMessage="Pick a start date first."
					value={startTime}
					onChange={onStartTimeChange}
				/>
			</FieldRow>

			{dailyWindow !== null ? null : (
				<FieldRow>
					<DateInput
						label="Deadline"
						isOptional
						hasClear
						description="Used to work out whether you are ahead or behind."
						format={formatDate}
						value={deadline}
						onChange={changeDeadline}
					/>
					<TimeField
						label="Due at"
						isOptional
						hasClear
						description="Leave empty and it is due at the start of that day."
						isDisabled={deadline === undefined}
						disabledMessage="Pick a deadline first."
						value={deadlineTime}
						onChange={onDeadlineTimeChange}
					/>
				</FieldRow>
			)}

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
							<TimeField
								label="From"
								isRequired
								value={dailyWindow.from}
								onChange={(from) => {
									if (from) onDailyWindowChange({ ...dailyWindow, from });
								}}
							/>
							<TimeField
								label="To"
								isRequired
								value={dailyWindow.to}
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
});
