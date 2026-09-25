import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack } from "@astryxdesign/core/Stack";
import { CircleAlert, Star, Zap } from "lucide-react";
import { SPECIAL_CHECKLIST_ICONS } from "#/components/checklists/special-checklist-icons";
import { shortTitle } from "#/lib/tasks/tasks";
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
	/** What kind of work it is — the one letter of "kind" nothing else took. */
	type: "k",
	/** Tag it: the character a tag is written with, wherever it is written. */
	tag: "#",
	/**
	 * In a team: take it on yourself, or give it back. The one key a thumb is
	 * already resting on, for the thing done most.
	 */
	assign: " ",
} as const;

export type TaskQuickActions = {
	/** Put the task on Today, or take it off; see `setSpecialTag`. */
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

/**
 * A shortcut beside a menu entry or a place in the side bar, drawn as the key
 * it is — the same cap the shortcuts panel draws; see `.thunderlist-key`.
 *
 * From `md` up only: a phone has no keyboard to press it on, and a key there
 * is a promise nothing can keep.
 */
export function ShortcutKey({ label }: { label: string }) {
	return <kbd className="thunderlist-key hidden md:inline-flex">{label}</kbd>;
}

/**
 * The Backlog entry for a row's overflow menu: parking the task there. The
 * Backlog is a checklist, named here as the user has named it — cut short with
 * an ellipsis if that name is long, so one rename cannot stretch the menu.
 */
export function backlogMenuItem(title: string, onMove: () => void) {
	return {
		label: `Move to ${shortTitle(title, 24)}`,
		icon: SPECIAL_CHECKLIST_ICONS.backlog,
		endContent: <ShortcutKey label={TASK_SHORTCUTS.backlog} />,
		onClick: onMove,
	};
}
