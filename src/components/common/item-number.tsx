import { formatNumber, type NumberedKind } from "#/schemas/number";

/**
 * A thing's number, `T-42`, small and quiet; see `NUMBER_PREFIXES`. Nothing
 * while it has none — for the moment between making something and the server
 * numbering it.
 */
export function ItemNumber({
	kind,
	number,
}: {
	kind: NumberedKind;
	number: number | undefined;
}) {
	if (number === undefined) return null;
	return (
		<span className="thunderlist-number">{formatNumber(kind, number)}</span>
	);
}

/**
 * A thing's number as the heading of its ⋯ menu — where it is looked up,
 * rather than printed ahead of its name. `undefined`, so no heading, while it
 * has none.
 */
export function numberTitle(
	kind: NumberedKind,
	number: number | undefined,
): string | undefined {
	return number === undefined ? undefined : formatNumber(kind, number);
}
