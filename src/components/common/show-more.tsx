import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/Stack";
import { ChevronDown } from "lucide-react";
import { PAGE_SIZE } from "#/lib/use-show-more";

/**
 * The last row of a list shown a page at a time; see `useShowMore`.
 *
 * It sits inside the list's card, under a divider like any other row, so it
 * reads as the list carrying on rather than as a control for the whole page.
 */
export function ShowMore({
	hidden,
	onShowMore,
}: {
	/** Rows not yet shown. With none, there is nothing to render. */
	hidden: number;
	onShowMore: () => void;
}) {
	if (hidden === 0) return null;

	return (
		<div className="thunderlist-row">
			<Divider />
			<HStack hAlign="center" paddingBlock={1}>
				<Button
					label={`Show ${Math.min(hidden, PAGE_SIZE)} more`}
					variant="ghost"
					size="sm"
					icon={<ChevronDown aria-hidden />}
					onClick={onShowMore}
				/>
			</HStack>
		</div>
	);
}
