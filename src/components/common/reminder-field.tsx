import { type ISOTimeString, TimeInput } from "@astryxdesign/core/TimeInput";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { ApplyChange } from "#/lib/changes";
import { browserTimeZone } from "#/lib/push";
import { remindersQuery } from "#/queries/reminders";
import type { ReminderTarget } from "#/schemas/reminder";

/** This person's reminder about one thing: its time, or `null` for none. */
export function useReminderTime(
	target: ReminderTarget,
	targetId: string | null,
): string | null {
	const reminders = useQuery(remindersQuery()).data ?? [];
	return (
		reminders.find(
			(each) => each.target === target && each.targetId === targetId,
		)?.time ?? null
	);
}

/** Set, move or take away one reminder; drawn at once, like every change. */
export function setReminder(
	apply: ApplyChange,
	target: ReminderTarget,
	targetId: string | null,
	time: string | null,
): void {
	apply({
		kind: "reminder.set",
		target,
		targetId,
		time,
		timeZone: browserTimeZone(),
	});
}

/**
 * A daily reminder about the thing a dialog edits, saved with the rest of it.
 *
 * The dialog holds the draft; `save` sends it when it changed, and is what the
 * dialog calls as it saves.
 */
export function useReminderDraft(
	isOpen: boolean,
	target: ReminderTarget,
	targetId: string | null,
): {
	time: string | null;
	setTime: (time: string | null) => void;
	save: (apply: ApplyChange) => void;
} {
	const saved = useReminderTime(target, targetId);
	const [time, setTime] = useState<string | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: read as the dialog opens, not followed while it is open.
	useEffect(() => {
		if (isOpen) setTime(saved);
	}, [isOpen]);

	return {
		time,
		setTime,
		save: (apply) => {
			if (targetId !== null && time !== saved) {
				setReminder(apply, target, targetId, time);
			}
		},
	};
}

/**
 * "Remind me daily at…", for one thing. Empty for no reminder. Only the
 * person setting it is reminded, on the devices they turned notifications on
 * for in Settings.
 */
export function ReminderField({
	label = "Daily reminder",
	description = "A notification to you, every day at this time. Turn notifications on in Settings.",
	value,
	onChange,
}: {
	label?: string;
	description?: string;
	value: string | null;
	onChange: (time: string | null) => void;
}) {
	return (
		<TimeInput
			label={label}
			isOptional
			hasClear
			description={description}
			value={(value ?? undefined) as ISOTimeString | undefined}
			onChange={(time) => onChange(time ? time.slice(0, 5) : null)}
		/>
	);
}
