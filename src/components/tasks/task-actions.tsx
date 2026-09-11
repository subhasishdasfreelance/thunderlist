import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack } from "@astryxdesign/core/Stack";
import { CircleAlert, Inbox, Star, Zap } from "lucide-react";
import type { SpecialTag, Tag } from "#/schemas/tag";

/**
 * What can be done to a task from its row, and the key that does it.
 *
 * The four quick actions are the ones done constantly — plan it, park it, mark
 * it pressing, mark it worth doing — so they are buttons on the row rather than
 * entries in a menu, and each carries the shortcut that fires it while the
 * pointer is over the row.
 */
export const TASK_SHORTCUTS = {
	today: "t",
	backlog: "b",
	urgent: "u",
	important: "i",
	complete: "x",
	edit: "e",
} as const;

export type TaskQuickActions = {
	/**
	 * Put the task on one of the special tags, Today or the Backlog, or take it
	 * off; see `setSpecialTag`.
	 */
	onSetSpecial: (kind: SpecialTag, isOn: boolean) => void;
	onSetUrgent: (urgent: boolean) => void;
	onSetImportant: (important: boolean) => void;
};

/**
 * The two flags, before the checkbox.
 *
 * They sit at the start of the row because they are set and read constantly —
 * more often than anything on the right — and because reading left to right the
 * useful order is "how much does this matter, then what is it".
 *
 * A flag that is on is tinted: warm for urgent, which is about time running
 * out, and a highlight for important, which is not. Both are tints Astryx
 * already uses for those meanings, so they carry the same weight here as
 * everywhere else and stay contrast-checked in both schemes. Urgent is an
 * exclamation mark rather than a bolt, because the bolt is Today's.
 */
export function TaskFlagButtons({
	title,
	urgent,
	important,
	actions,
}: {
	title: string;
	urgent: boolean;
	important: boolean;
	actions: Pick<TaskQuickActions, "onSetUrgent" | "onSetImportant">;
}) {
	return (
		<HStack gap={0} vAlign="center">
			<span className="thunderlist-flag" data-flag="urgent" data-on={urgent}>
				<IconButton
					label={urgent ? `${title} is urgent` : `Mark ${title} urgent`}
					tooltip={`${urgent ? "Urgent" : "Mark urgent"} (${TASK_SHORTCUTS.urgent})`}
					variant="ghost"
					size="sm"
					icon={<CircleAlert aria-hidden />}
					onClick={() => actions.onSetUrgent(!urgent)}
				/>
			</span>

			<span
				className="thunderlist-flag"
				data-flag="important"
				data-on={important}
			>
				<IconButton
					label={
						important ? `${title} is important` : `Mark ${title} important`
					}
					tooltip={`${important ? "Important" : "Mark important"} (${TASK_SHORTCUTS.important})`}
					variant="ghost"
					size="sm"
					icon={<Star aria-hidden />}
					onClick={() => actions.onSetImportant(!important)}
				/>
			</span>
		</HStack>
	);
}

/**
 * Putting a task on Today, at the end of the row.
 *
 * Today is a tag, and this is the quick way to write it: the bolt adds it to the
 * end of the title, and pressing it again takes it out wherever it was
 * written. It is the app's own bolt, lit in the bolt's gold while the task is
 * on Today. The tag's name is the user's to change — `#doing`, say — and the
 * button writes whatever it is called.
 *
 * Parking something in the Backlog is a decision made far less often, so it is
 * in the menu rather than spending a button's width on every row forever.
 */
export function TodayButton({
	title,
	today,
	isOn,
	onToggle,
}: {
	title: string;
	today: Tag;
	isOn: boolean;
	onToggle: () => void;
}) {
	const name = `#${today.name}`;

	return (
		<span className="thunderlist-flag" data-flag="today" data-on={isOn}>
			<IconButton
				label={isOn ? `Take ${title} off ${name}` : `Add ${title} to ${name}`}
				tooltip={`${isOn ? `On ${name} — press to take off` : `Add to ${name}`} (${TASK_SHORTCUTS.today})`}
				variant="ghost"
				size="sm"
				icon={<Zap aria-hidden />}
				onClick={onToggle}
			/>
		</span>
	);
}

/** The Backlog entry for a row's overflow menu. */
export function backlogMenuItem(
	backlog: Tag,
	isOn: boolean,
	onToggle: () => void,
) {
	return {
		label: `${isOn ? "Take off" : "Move to"} #${backlog.name} (${TASK_SHORTCUTS.backlog})`,
		icon: <Inbox aria-hidden />,
		onClick: onToggle,
	};
}
