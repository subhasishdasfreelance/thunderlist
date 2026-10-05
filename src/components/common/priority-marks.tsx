import { Icon } from "@astryxdesign/core/Icon";
import { HStack } from "@astryxdesign/core/Stack";
import { CircleAlert, Star } from "lucide-react";
import { SPECIAL_TAG_ICONS } from "#/components/tags/special-tag-icons";

type Flags = { urgent?: boolean; important?: boolean; focused?: boolean };

/**
 * Urgent, important and current focus on a checklist, tracker or tag card, in
 * the icons and tints a task's flags use; see `TaskFlagButtons` and
 * `FocusButton`. Nothing for none.
 *
 * Only shown: they are set with Edit over a pick — or, on a checklist's card,
 * by its own flag buttons, which take these marks' place for anyone who may
 * press them. Said in the card's own label instead; see `priorityWords`.
 */
export function PriorityMarks({ urgent, important, focused }: Flags) {
	if (!urgent && !important && !focused) return null;

	return (
		// Whole beside a title cut short; see `.thunderlist-card-title`.
		<HStack gap={0.5} vAlign="center" style={{ flexShrink: 0 }}>
			{urgent ? <Icon icon={CircleAlert} size="sm" color="orange" /> : null}
			{important ? <Icon icon={Star} size="sm" color="purple" /> : null}
			{focused ? (
				<Icon icon={SPECIAL_TAG_ICONS.focus} size="sm" color="teal" />
			) : null}
		</HStack>
	);
}

/**
 * ", urgent, important, current focus", for the end of a card's label; ""
 * for none.
 */
export function priorityWords({ urgent, important, focused }: Flags): string {
	return `${urgent ? ", urgent" : ""}${important ? ", important" : ""}${focused ? ", current focus" : ""}`;
}
