import { Text } from "@astryxdesign/core/Text";
import type { ReactNode } from "react";

/**
 * A card's last line: its pace in words, and on a phone the card's flag
 * buttons at the start of it, moved off the title row so the title keeps its
 * width. From `md` up the flags are beside the title instead, and a card with
 * no words to say has no last line at all.
 *
 * The words stay beside the flags while they fit on one line there, and drop
 * to a line of their own below them when they do not, rather than being
 * squeezed into a narrow column of three words a line.
 */
export function CardLastLine({
	summary,
	flags,
}: {
	summary: string | null;
	/** The flag buttons, or `null` for someone who may not press them. */
	flags: ReactNode | null;
}) {
	if (summary === null && flags === null) return null;

	return (
		<div
			className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${summary === null ? "md:hidden" : ""}`}
		>
			{/* First, as beside the title on a desktop. */}
			{flags === null ? null : (
				<div className="thunderlist-row-buttons flex shrink-0 items-center md:hidden">
					{flags}
				</div>
			)}
			{summary === null ? null : (
				<Text type="supporting" className="max-w-full shrink-0">
					{summary}
				</Text>
			)}
		</div>
	);
}
