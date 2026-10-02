import * as v from "valibot";
import { idSchema } from "./common";

/**
 * How a space orders its checklists, its trackers, its tags and its plans by
 * hand.
 *
 * One per list, kept in the space's settings, so it is one write however much
 * moves and a team sees the same order. Something new is last in the order
 * until it is moved. Collections of them are groups, which have a page of
 * their own; see `Group`.
 *
 * An id here that names nothing — deleted since, or kept from whoever is
 * looking — is ignored when the list is drawn and kept when it is written,
 * so nobody's arranging loses a place in the order they cannot see.
 */

const ARRANGED_LISTS = ["checklists", "trackers", "tags", "plans"] as const;

export type ArrangedList = (typeof ARRANGED_LISTS)[number];

const arrangementSchema = v.object({
	/** Ids in the order picked by hand; see `manualOrder`. */
	order: v.array(idSchema),
});

export type Arrangement = v.InferOutput<typeof arrangementSchema>;

/** Every list's arrangement, as the space has them. */
export type Arrangements = Partial<Record<ArrangedList, Arrangement>>;

export const EMPTY_ARRANGEMENT: Arrangement = { order: [] };

/** One list's whole arrangement, written at once; see `arrangement.set`. */
export const arrangementInputSchema = v.object({
	list: v.picklist(ARRANGED_LISTS),
	arrangement: arrangementSchema,
});

/**
 * How a list of cards is ordered; see `ListOrderMenu`. By priority only where
 * the cards carry one: a group's.
 */
export type ListOrder = "behind" | "newest" | "manual" | "priority";

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
