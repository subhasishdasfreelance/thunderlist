/**
 * The order and filters a list of tasks is shown with, kept in its address.
 *
 * A reload, Back, or a link someone sends lands on the same rows, as the
 * stage and the page on show already do. Only what differs from the default is
 * written, so a screen shown plainly keeps a plain address — and arriving by
 * the nav, which carries none of it, is arriving at the plain screen.
 *
 * `who` is a person's address (see `MemberFilter`); `tag` and `type` are ids.
 */

import { SORT_ORDERS } from "#/schemas/task";
import type { SortOrder } from "./tasks/tasks";

export type FilterSearch = {
	sort?: SortOrder;
	who?: string;
	tag?: string;
	type?: string;
};

/** A search param that says something, or `undefined`. */
export function searchText(value: unknown): string | undefined {
	return typeof value === "string" && value !== "" ? value : undefined;
}

/** The order and filters in an address, for a route's `validateSearch`. */
export function filterSearch(search: Record<string, unknown>): FilterSearch {
	const sort = SORT_ORDERS.find((order) => order === search.sort);

	return {
		sort: sort === "newest" ? undefined : sort,
		who: searchText(search.who),
		tag: searchText(search.tag),
		type: searchText(search.type),
	};
}

/** The same, as written back: the default order is left out of the address. */
export function sortParam(sort: SortOrder): SortOrder | undefined {
	return sort === "newest" ? undefined : sort;
}
