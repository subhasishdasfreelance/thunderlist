import { Text } from "@astryxdesign/core/Text";
import { sameTagName, splitTitleTags } from "#/lib/tags/inline-tags";
import type { Tag } from "#/schemas/tag";

/**
 * A task title with its tags highlighted where they were written.
 *
 * "Hello #me hi" reads back as "Hello #me hi" — the tag is picked out in its
 * own colour but stays in the sentence, because that is where the user put it
 * and the sentence usually needs it to make sense.
 *
 * A `#name` with no tag behind it — one still queued, or one since deleted —
 * is drawn plainly rather than disappearing, so the text is never a lie about
 * what was typed.
 */
export function TaggedTitle({
	title,
	tags,
	isMuted = false,
}: {
	title: string;
	tags: ReadonlyArray<Tag>;
	/** Completed work is settled, not gone; it dims rather than disappears. */
	isMuted?: boolean;
}) {
	const segments = splitTitleTags(title);

	return (
		<Text color={isMuted ? "secondary" : "primary"}>
			{segments.map((segment) =>
				segment.kind === "text" ? (
					<span key={segment.at}>{segment.text}</span>
				) : (
					<span
						key={segment.at}
						className="thunderlist-tag"
						data-color={
							tags.find((tag) => sameTagName(tag.name, segment.name))?.color ??
							"none"
						}
					>
						#{segment.name}
					</span>
				),
			)}
		</Text>
	);
}
