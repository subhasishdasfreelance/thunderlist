import {
	CalendarCheck,
	Inbox,
	ListChecks,
	Tags,
	Target,
	TrendingUp,
} from "lucide-react";

/**
 * The six primary destinations, in the order work moves through them.
 *
 * Backlog and Lists are where a task waits; Today is what you picked out of
 * them, and it is where the app opens, so it sits third — near the thumb on a
 * phone rather than at one end of the bar. Priority, Tags and Trackers are ways
 * of looking back at all of it. Detail routes live underneath these and are
 * deliberately not entries of their own, and neither is the shortcuts
 * reference, which is reached from the account menu.
 *
 * `shortLabel` is what the bottom bar uses: six labels have to share a phone
 * screen, and a truncated word reads worse than a shorter one.
 */
export const NAV_ITEMS = [
	{ to: "/backlog", label: "Backlog", shortLabel: "Backlog", icon: Inbox },
	{
		to: "/checklists",
		label: "Checklists",
		shortLabel: "Lists",
		icon: ListChecks,
	},
	{ to: "/today", label: "Today", shortLabel: "Today", icon: CalendarCheck },
	{ to: "/priority", label: "Priority", shortLabel: "Priority", icon: Target },
	{ to: "/tags", label: "Tags", shortLabel: "Tags", icon: Tags },
	{
		to: "/trackers",
		label: "Trackers",
		shortLabel: "Trackers",
		icon: TrendingUp,
	},
] as const;

/** A nav entry is active for its own route and for any detail route below it. */
export function isNavItemActive(pathname: string, to: string): boolean {
	return pathname === to || pathname.startsWith(`${to}/`);
}
