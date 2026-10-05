import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack } from "@astryxdesign/core/Stack";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Star } from "lucide-react";
import { SPECIAL_CHECKLIST_ICONS } from "#/components/checklists/special-checklist-icons";
import { SPECIAL_TAG_ICONS } from "#/components/tags/special-tag-icons";
import { shortTitle } from "#/lib/tasks/tasks";
import { tagsQuery } from "#/queries/tags";
import { type SpecialTag, specialTag, type Tag } from "#/schemas/tag";

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
	/** Current focus: the one letter of the name nothing else took. */
	focus: "c",
	backlog: "b",
	/** Move it to another checklist, picked from the list. */
	move: "m",
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
	/** Delete it, after the usual confirmation. */
	delete: "d",
} as const;

/** The stage tab after the one shown, and the one before; see `StageTabs`. */
export const STAGE_SHORTCUTS = { next: ">", previous: "<" } as const;

export type TaskQuickActions = {
	/**
	 * Put the task on Today or Current focus, or take it off; see
	 * `setSpecialTag`.
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
	hasShortcuts = true,
}: {
	title: string;
	urgent: boolean;
	important: boolean;
	actions: Pick<TaskQuickActions, "onSetUrgent" | "onSetImportant">;
	/** False where no key fires them, as on a checklist's card. */
	hasShortcuts?: boolean;
}) {
	const key = (letter: string) => (hasShortcuts ? ` (${letter})` : "");

	return (
		<HStack gap={0} vAlign="center">
			<span className="thunderlist-flag" data-flag="urgent" data-on={urgent}>
				<IconButton
					label={urgent ? `${title} is urgent` : `Mark ${title} urgent`}
					tooltip={`${urgent ? "Urgent" : "Mark urgent"}${key(TASK_SHORTCUTS.urgent)}`}
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
					tooltip={`${important ? "Important" : "Mark important"}${key(TASK_SHORTCUTS.important)}`}
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
 * Putting a task on Today, or on Current focus beside it, at the end of the
 * row.
 *
 * Each is a tag, and this is the quick way to write it: the button adds it to
 * the end of the title, and pressing it again takes it out wherever it was
 * written. Today's is the app's own bolt, lit in the bolt's gold while the
 * task is on Today; Current focus's lights in teal. The tag's name is the
 * user's to change — `#doing`, say — and the button writes whatever it is
 * called.
 *
 * Parking something in the Backlog is a decision made far less often, so it is
 * in the menu rather than spending a button's width on every row forever.
 */
export function SpecialTagButton({
	kind,
	title,
	tag,
	isOn,
	onToggle,
	hasShortcut = true,
}: {
	kind: SpecialTag;
	title: string;
	tag: Tag;
	isOn: boolean;
	onToggle: () => void;
	/** False where no key fires it, as on a checklist's card. */
	hasShortcut?: boolean;
}) {
	const name = `#${tag.name}`;
	const Mark = SPECIAL_TAG_ICONS[kind];
	const key = hasShortcut ? ` (${TASK_SHORTCUTS[kind]})` : "";

	return (
		<span className="thunderlist-flag" data-flag={kind} data-on={isOn}>
			<IconButton
				label={isOn ? `Take ${title} off ${name}` : `Add ${title} to ${name}`}
				tooltip={`${isOn ? `On ${name} — press to take off` : `Add to ${name}`}${key}`}
				variant="ghost"
				size="sm"
				icon={<Mark aria-hidden />}
				onClick={onToggle}
			/>
		</span>
	);
}

/**
 * Marking a checklist, tracker or tag as current focus, beside its urgent and
 * important flags: it is then listed, as itself, on the Current focus tag's
 * page; see `SPECIAL_TAGS`. Named as that tag is named, so nothing until the
 * tags have loaded.
 */
export function FocusButton({
	title,
	isOn,
	onToggle,
}: {
	title: string;
	isOn: boolean;
	onToggle: (isOn: boolean) => void;
}) {
	const focus = specialTag(useQuery(tagsQuery()).data ?? [], "focus");
	if (focus === null) return null;

	return (
		<SpecialTagButton
			kind="focus"
			title={title}
			tag={focus}
			isOn={isOn}
			onToggle={() => onToggle(!isOn)}
			hasShortcut={false}
		/>
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
