import {
	CalendarCheck,
	Inbox,
	ListChecks,
	Tags,
	Target,
	TrendingUp,
} from "lucide-react";

/**
 * The six primary destinations, with Today in the middle.
 *
 * Today is where the app opens and the one screen used every day, so it sits
 * near the thumb on a phone rather than at one end of the bar. Checklists and
 * Backlog feed it from the left; Priority, Trackers and Tags sit to the right.
 * Detail routes live underneath these and are deliberately not entries of their
 * own, and neither is the shortcuts reference, which is reached from the
 * account menu.
 *
 * `shortLabel` is what the bottom bar uses: six labels have to share a phone
 * screen, and a truncated word reads worse than a shorter one.
 */
export const NAV_ITEMS = [
	{
		to: "/checklists",
		label: "Checklists",
		shortLabel: "Lists",
		icon: ListChecks,
	},
	{ to: "/backlog", label: "Backlog", shortLabel: "Backlog", icon: Inbox },
	{ to: "/today", label: "Today", shortLabel: "Today", icon: CalendarCheck },
	{ to: "/priority", label: "Priority", shortLabel: "Priority", icon: Target },
	{
		to: "/trackers",
		label: "Trackers",
		shortLabel: "Trackers",
		icon: TrendingUp,
	},
	{ to: "/tags", label: "Tags", shortLabel: "Tags", icon: Tags },
] as const;

/** A nav entry is active for its own route and for any detail route below it. */
export function isNavItemActive(pathname: string, to: string): boolean {
	return pathname === to || pathname.startsWith(`${to}/`);
}
