import { sameTagName, splitTitleTags } from "#/lib/tags/inline-tags";
import type { Tag } from "#/schemas/tag";

/**
 * A title with its `#tags` drawn in place.
 *
 * Two things render this and they must agree character for character: the title
 * on a row, and the coloured layer behind the text field you type it into. If
 * they ever drew a tag differently the caret in that field would sit in the
 * wrong place, so the drawing lives here once rather than in both.
 *
 * A tag with no colour yet — just typed, or since deleted — falls back to the
 * neutral pair rather than vanishing into the surrounding text. A line naming a
 * tracker is drawn as one mark for the whole line.
 */
export function TagSegments({
	title,
	tags,
}: {
	title: string;
	/** Every tag that exists, for looking up the colour of each one written. */
	tags: ReadonlyArray<Tag>;
}) {
	return splitTitleTags(title).map((segment) => {
		if (segment.kind === "text") {
			return <span key={segment.at}>{segment.text}</span>;
		}

		// A tracker takes the accent rather than a tag colour: it is not one of
		// the tag palette's members, and it is the whole line rather than a word
		// inside one.
		if (segment.kind === "tracker") {
			return (
				<span key={segment.at} className="thunderlist-tag" data-color="blue">
					&amp;{segment.name}
				</span>
			);
		}

		return (
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
		);
	});
}
