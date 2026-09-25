import * as v from "valibot";
import { idSchema } from "./common";

/**
 * How a space lays out its checklists, its trackers and its tags: an order
 * picked by hand, and groups — plain named collections, with nothing in them
 * but which things belong.
 *
 * One per list, kept in the space's settings, so it is one write however much
 * moves and a team sees the same layout. Something in no group is simply
 * ungrouped; something new is last in the hand-picked order until it is moved.
 *
 * An id here that names nothing — deleted since, or kept from whoever is
 * looking — is ignored when the list is drawn and kept when it is written,
 * so nobody's arranging loses a place in the order they cannot see.
 */

export const ARRANGED_LISTS = ["checklists", "trackers", "tags"] as const;

export type ArrangedList = (typeof ARRANGED_LISTS)[number];

const groupNameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "Every group needs a name"),
	v.maxLength(40, "Group names must be 40 characters or fewer"),
);

const groupSchema = v.object({
	groupId: idSchema,
	name: groupNameSchema,
	itemIds: v.array(idSchema),
});

export type ListGroup = v.InferOutput<typeof groupSchema>;

const arrangementSchema = v.object({
	/** Ids in the order picked by hand; see `manualOrder`. */
	order: v.array(idSchema),
	groups: v.pipe(
		v.array(groupSchema),
		v.maxLength(50, "At most 50 groups"),
		v.check(
			(groups) =>
				new Set(groups.map((group) => group.name.toLowerCase())).size ===
				groups.length,
			"Two groups can't share a name",
		),
	),
});

export type Arrangement = v.InferOutput<typeof arrangementSchema>;

/** Every list's arrangement, as the space has them. */
export type Arrangements = Partial<Record<ArrangedList, Arrangement>>;

export const EMPTY_ARRANGEMENT: Arrangement = { order: [], groups: [] };

/** One list's whole arrangement, written at once; see `arrangement.set`. */
export const arrangementInputSchema = v.object({
	list: v.picklist(ARRANGED_LISTS),
	arrangement: arrangementSchema,
});

/** How a list of cards is ordered; see `ListOrderMenu`. */
export type ListOrder = "behind" | "newest" | "manual";

/**
 * `items` in the order picked by hand: the ones placed first, as placed, then
 * everything not placed yet, in the order it came.
 */
export function manualOrder<T>(
	items: ReadonlyArray<T>,
	idOf: (item: T) => string,
	order: ReadonlyArray<string>,
): Array<T> {
	const at = new Map(order.map((id, index) => [id, index]));
	const placed = items.filter((item) => at.has(idOf(item)));
	const rest = items.filter((item) => !at.has(idOf(item)));

	return [
		...placed.sort((a, b) => (at.get(idOf(a)) ?? 0) - (at.get(idOf(b)) ?? 0)),
		...rest,
	];
}

/** One stretch of a list: a group's cards, or the ungrouped ones. */
export type ListSection<T> = {
	/** `null` for the things in no group. */
	group: ListGroup | null;
	items: Array<T>;
};

/**
 * `items` — already in the order to show them — cut into their groups, in the
 * groups' own order, with the ungrouped last. A group with nothing in it to
 * show is left out; so is the ungrouped stretch when it is empty.
 *
 * Something named by two groups is in the first of them.
 */
export function sectionsOf<T>(
	items: ReadonlyArray<T>,
	idOf: (item: T) => string,
	groups: ReadonlyArray<ListGroup>,
): Array<ListSection<T>> {
	const home = new Map<string, string>();
	for (const group of groups) {
		for (const id of group.itemIds) {
			if (!home.has(id)) home.set(id, group.groupId);
		}
	}

	const sections: Array<ListSection<T>> = groups.map((group) => ({
		group,
		items: items.filter((item) => home.get(idOf(item)) === group.groupId),
	}));
	const loose = items.filter((item) => !home.has(idOf(item)));

	return [
		...sections.filter((section) => section.items.length > 0),
		...(loose.length === 0 ? [] : [{ group: null, items: loose }]),
	];
}
