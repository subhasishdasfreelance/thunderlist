import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { TagSegments } from "#/components/tags/tag-segments";
import { unwrittenTags } from "#/lib/tags/inline-tags";
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
 *
 * A tag the task carries without its title naming it — one it has from its
 * checklist — has no place in the sentence, so it follows the title as a chip.
 */
export function TaggedTitle({
	title,
	tags,
	tagIds = [],
	isMuted = false,
}: {
	title: string;
	tags: ReadonlyArray<Tag>;
	/** The task's own tags; any its title does not write are drawn as chips. */
	tagIds?: ReadonlyArray<string>;
	/** Completed work is settled, not gone; it dims rather than disappears. */
	isMuted?: boolean;
}) {
	return (
		<Text color={isMuted ? "secondary" : "primary"}>
			{/* What `useTaskCopy` copies when several tasks are selected. */}
			<span data-task-title>
				<TagSegments title={title} tags={tags} />
			</span>
			{unwrittenTags(title, tagIds, tags).map((tag) => (
				<span key={tag.tagId} className="ms-1.5 inline-flex align-middle">
					<Token size="sm" color={tag.color} label={tag.name} />
				</span>
			))}
		</Text>
	);
}
