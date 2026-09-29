/**
 * Every thing a person makes carries a number as well as its id: T-42 for a
 * task, C-3 for a checklist. The id is for the app — random, minted in the
 * browser, never shown. The number is for people: short enough to say out
 * loud, write in a note, or type into search.
 *
 * Each kind counts on its own, one after another within a space, so a team
 * shares its numbering. The server hands them out as things are made, which
 * is why one drawn a moment ago has none until the save lands; see
 * `nextNumber`.
 */
export const NUMBER_PREFIXES = {
	task: "T",
	checklist: "C",
	tracker: "TR",
	tag: "TG",
	entry: "E",
	plan: "P",
	countdown: "CD",
	group: "G",
} as const;

export type NumberedKind = keyof typeof NUMBER_PREFIXES;

export const NUMBERED_KINDS = Object.keys(
	NUMBER_PREFIXES,
) as Array<NumberedKind>;

/** `T-42`. */
export function formatNumber(kind: NumberedKind, number: number): string {
	return `${NUMBER_PREFIXES[kind]}-${number}`;
}

/**
 * A search that names a number: `T-42`, `t42`, `tr 7` or `#42` — or a bare
 * `42`, which is any kind's 42. `null` for anything else.
 */
export function parseNumberQuery(
	query: string,
): { kind: NumberedKind | null; number: number } | null {
	const match = /^#?\s*([a-z]{0,2})\s*[-\s]?\s*(\d+)$/i.exec(query.trim());
	if (match === null) return null;

	const [, prefix, digits] = match;
	const number = Number(digits);
	if (prefix === "") return { kind: null, number };

	const kind =
		NUMBERED_KINDS.find(
			(each) => NUMBER_PREFIXES[each].toLowerCase() === prefix.toLowerCase(),
		) ?? null;
	return kind === null ? null : { kind, number };
}
