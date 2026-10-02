import { Icon } from "@astryxdesign/core/Icon";
import { HStack } from "@astryxdesign/core/Stack";
import { CircleAlert, Star } from "lucide-react";

type Flags = { urgent?: boolean; important?: boolean };

/**
 * Urgent and important on a checklist, tracker or tag card, in the icons and
 * tints a task's flags use; see `TaskFlagButtons`. Nothing for neither.
 *
 * Only shown: the card is a link, and they are set with Edit over a pick.
 * Said in the card's own label instead; see `priorityWords`.
 */
export function PriorityMarks({ urgent, important }: Flags) {
	if (!urgent && !important) return null;

	return (
		// Whole beside a title cut short; see `.thunderlist-card-title`.
		<HStack gap={0.5} vAlign="center" style={{ flexShrink: 0 }}>
			{urgent ? <Icon icon={CircleAlert} size="sm" color="orange" /> : null}
			{important ? <Icon icon={Star} size="sm" color="purple" /> : null}
		</HStack>
	);
}

/** ", urgent, important", for the end of a card's label; "" for neither. */
export function priorityWords({ urgent, important }: Flags): string {
	return `${urgent ? ", urgent" : ""}${important ? ", important" : ""}`;
}
