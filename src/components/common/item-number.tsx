import { formatNumber, type NumberedKind } from "#/schemas/number";

/**
 * A thing's number, `T-42`, small and quiet ahead of its name; see
 * `NUMBER_PREFIXES`. Nothing while it has none — for the moment between
 * making something and the server numbering it.
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
