import { FieldLabel } from "@astryxdesign/core/Field";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { useId } from "react";
import { isInlineTagName, parseInlineTags } from "#/lib/tags/inline-tags";
import { type Tag, tagsFor } from "#/schemas/tag";
import { TagTextField } from "./tag-text-field";

/**
 * What a tags field holds while it is being edited.
 *
 * `text` is the tags written as `#name`, the way a task's are. `kept` is every
 * tag that cannot be written that way — a name with a space in it, or a tag
 * that has not loaded — carried through untouched, so saving never drops or
 * renames one by accident.
 */
export type TagsDraft = { text: string; kept: Array<string> };

export const EMPTY_TAGS_DRAFT: TagsDraft = { text: "", kept: [] };

/** A draft of the tags something carries now. */
export function tagsDraft(
	tagIds: ReadonlyArray<string>,
	tags: ReadonlyArray<Tag>,
): TagsDraft {
	const writable = tagsFor(tagIds, tags).filter((tag) =>
		isInlineTagName(tag.name),
	);

	return {
		text: writable.map((tag) => `#${tag.name} `).join(""),
		kept: tagIds.filter(
			(tagId) => !writable.some((tag) => tag.tagId === tagId),
		),
	};
}

/**
 * The tag ids a draft stands for. `resolveTags` turns the written names into
 * ids, making a tag for any name that does not exist yet.
 */
export function draftTagIds(
	draft: TagsDraft,
	resolveTags: (names: Array<string>) => Array<string>,
): Array<string> {
	const written = resolveTags(parseInlineTags(draft.text).tagNames);
	return [...new Set([...draft.kept, ...written])];
}

/**
 * The tags on a checklist or a tracker, typed as `#name` with the same
 * completion a task's title has. A new name becomes a new tag on save, just as
 * it does in a task.
 */
export function TagsField({
	label,
	description,
	tags,
	draft,
	onChange,
	onSubmit,
}: {
	label: string;
	description: string;
	/** Every tag that exists, for completing names and drawing the kept ones. */
	tags: ReadonlyArray<Tag>;
	draft: TagsDraft;
	onChange: (draft: TagsDraft) => void;
	/** Enter, when no suggestion is being chosen. */
	onSubmit: () => void;
}) {
	const labelFor = useId();
	const keptTags = tagsFor(draft.kept, tags);

	return (
		<VStack gap={1}>
			{/* Only the visible heading: the field carries its own hidden label. */}
			<FieldLabel label={label} inputID={labelFor} isOptional />
			<TagTextField
				label={label}
				placeholder="#tag"
				value={draft.text}
				onChange={(text) => onChange({ ...draft, text })}
				onSubmit={onSubmit}
				// Only names that survive being written, or picking one would save
				// something else.
				tags={tags.filter((tag) => isInlineTagName(tag.name))}
			/>
			{keptTags.length === 0 ? null : (
				<HStack gap={1} wrap="wrap">
					{keptTags.map((tag) => (
						<Token
							key={tag.tagId}
							size="sm"
							color={tag.color}
							label={tag.name}
							onRemove={() =>
								onChange({
									...draft,
									kept: draft.kept.filter((tagId) => tagId !== tag.tagId),
								})
							}
						/>
					))}
				</HStack>
			)}
			<Text type="supporting">{description}</Text>
		</VStack>
	);
}
