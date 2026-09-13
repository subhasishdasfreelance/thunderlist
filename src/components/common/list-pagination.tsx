import { Divider } from "@astryxdesign/core/Divider";
import { Pagination } from "@astryxdesign/core/Pagination";
import { HStack } from "@astryxdesign/core/Stack";
import { useRef } from "react";
import { PAGE_SIZE } from "#/lib/use-pages";

/**
 * The last row of a list shown a page at a time; see `usePages`.
 *
 * It sits inside the list's card, under a divider like any other row, so it
 * reads as the list carrying on rather than as a control for the whole page.
 * The pages are numbered, so any one of them is a click away — and turning one
 * brings the top of the list back into view, where the new page starts, rather
 * than leaving the reader at the bottom of it.
 */
export function ListPagination({
	page,
	total,
	onChange,
}: {
	/** The page shown, from 1. */
	page: number;
	/** Rows in the whole list. With a page's worth or fewer, nothing is drawn. */
	total: number;
	onChange: (page: number) => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	if (total <= PAGE_SIZE) return null;

	return (
		<div ref={ref} className="thunderlist-row thunderlist-pagination">
			<Divider />
			<HStack hAlign="center" paddingBlock={1}>
				<Pagination
					page={page}
					totalItems={total}
					pageSize={PAGE_SIZE}
					size="sm"
					label="Pages of this list"
					onChange={(next) => {
						onChange(next);
						ref.current?.parentElement?.scrollIntoView({
							block: "start",
							behavior: "smooth",
						});
					}}
				/>
			</HStack>
		</div>
	);
}
