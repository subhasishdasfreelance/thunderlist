import { Archive, Inbox, type LucideIcon } from "lucide-react";
import type { SpecialChecklist } from "#/schemas/checklist";

/**
 * The mark of each special checklist, wherever the checklist itself is drawn.
 *
 * The Inbox is the tray things land in. The Backlog is the box they are put
 * away in until they are picked.
 */
export const SPECIAL_CHECKLIST_ICONS: Record<SpecialChecklist, LucideIcon> = {
	inbox: Inbox,
	backlog: Archive,
};
