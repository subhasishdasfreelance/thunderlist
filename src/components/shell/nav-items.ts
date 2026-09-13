import { ListChecks, Tags, Target, TrendingUp } from "lucide-react";

/**
 * The primary destinations.
 *
 * Checklists are where work lives; Priority, Tags and Trackers are ways of
 * looking across all of it. Today and the Backlog are tags, so they are reached
 * from the Tags screen rather than having entries of their own — and Today is
 * where the app opens. Detail routes live underneath these and are
 * deliberately not entries either, and neither is the shortcuts reference,
 * which has its own button in the top bar.
 *
 * `shortLabel` is what the bottom bar uses: the labels share a phone screen,
 * and a truncated word reads worse than a shorter one.
 */
export const NAV_ITEMS = [
	{
		to: "/checklists",
		label: "Checklists",
		shortLabel: "Lists",
		icon: ListChecks,
	},
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
