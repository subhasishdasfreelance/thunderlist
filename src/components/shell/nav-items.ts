import {
	ListChecks,
	NotebookText,
	SquareKanban,
	Tags,
	Target,
	TrendingUp,
} from "lucide-react";

/**
 * The primary destinations.
 *
 * Checklists are where work lives, the Inbox and the Backlog among them;
 * Priority, Across lists, Tags and Trackers are ways of looking across all
 * of it; Plans are the documents the work follows.
 * Today is a tag, so it is reached from the Tags screen rather than having an
 * entry of its own — and Today is where the app opens. Detail routes live
 * underneath these and are deliberately not entries either, and neither is the
 * shortcuts reference, which has its own button in the top bar.
 *
 * `shortLabel` is what the bottom bar uses: the labels share a phone screen,
 * and a truncated word reads worse than a shorter one.
 *
 * `key` is the digit that goes there from anywhere; see `PAGE_SHORTCUTS`.
 *
 * `isInMore` puts an entry in the phone bar's "More" dropup rather than on
 * the bar itself: five places are what a phone's width holds, and these are
 * the ones visited least. The side bar shows every one.
 */
export const NAV_ITEMS: ReadonlyArray<{
	to: string;
	label: string;
	shortLabel: string;
	icon: typeof ListChecks;
	key: string;
	isInMore?: boolean;
}> = [
	{
		to: "/checklists",
		label: "Checklists",
		shortLabel: "Lists",
		icon: ListChecks,
		key: "2",
	},
	{
		to: "/priority",
		label: "Priority",
		shortLabel: "Priority",
		icon: Target,
		key: "3",
	},
	{
		to: "/stages",
		label: "Across lists",
		shortLabel: "Across",
		icon: SquareKanban,
		key: "4",
		isInMore: true,
	},
	{ to: "/tags", label: "Tags", shortLabel: "Tags", icon: Tags, key: "5" },
	{
		to: "/trackers",
		label: "Trackers",
		shortLabel: "Trackers",
		icon: TrendingUp,
		key: "6",
	},
	{
		to: "/plans",
		label: "Plans",
		shortLabel: "Plans",
		icon: NotebookText,
		key: "7",
		isInMore: true,
	},
];

/**
 * The digit that goes to each screen, from anywhere that is not a text field.
 *
 * Digits, because every letter on this keyboard already belongs to the row
 * under the pointer — and because the order is the order of the bar, so the
 * key and the place it goes are the same list read twice.
 *
 * Today leads it. It is not a bar entry, being a tag, but it is where the app
 * opens and the screen anyone comes back to, so it would be strange for it to
 * be the one screen with no key.
 */
export const PAGE_SHORTCUTS: ReadonlyArray<{
	key: string;
	label: string;
	/** Where it goes, as `Link` takes it. */
	to: string;
	/** The route params it needs, for the one screen that takes any. */
	params?: Record<string, string>;
}> = [
	{ key: "1", label: "Today", to: "/tags/$tagId", params: { tagId: "today" } },
	...NAV_ITEMS.map((item) => ({
		key: item.key,
		label: item.label,
		to: item.to,
	})),
];

/** A nav entry is active for its own route and for any detail route below it. */
export function isNavItemActive(pathname: string, to: string): boolean {
	return pathname === to || pathname.startsWith(`${to}/`);
}
