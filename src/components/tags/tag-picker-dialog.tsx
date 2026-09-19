import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Token } from "@astryxdesign/core/Token";
import { Check, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { isInlineTagName } from "#/lib/tags/inline-tags";
import type { Tag } from "#/schemas/tag";

/**
 * Put a tag on a task — `#`, while pointing at it — or on every task picked
 * out at once.
 *
 * The same shape as the type picker: a filter, then the list, so two letters
 * and Enter is quicker than reaching for the title and typing the tag in by
 * hand. Which it is quicker *than* matters here, because a tag can always be
 * written into the title instead; this is for when the title is already
 * written and the tag is an afterthought.
 *
 * A name matching nothing offers to make it, as typing `#name` into a title
 * does — a tag is never a dead end, wherever it is named. Only for whoever may
 * make one, and only for a name that could be written into a title at all.
 */
export function TagPickerDialog({
	isOpen,
	onOpenChange,
	tags,
	subtitle,
	current,
	canCreate,
	onPick,
	onCreate,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** Every tag there is. */
	tags: ReadonlyArray<Tag>;
	/** What is being tagged: a task's title, or how many tasks there are. */
	subtitle: string;
	/**
	 * The tags already on it — on every one of them, where there are several.
	 * Ticked, and picking one again takes it off a single task.
	 */
	current: ReadonlyArray<string>;
	/** Whether a name matching nothing offers to become a tag. */
	canCreate: boolean;
	onPick: (tag: Tag) => void;
	/** Make a tag of this name and put it on; see `createTagResolver`. */
	onCreate: (name: string) => void;
}) {
	const [query, setQuery] = useState("");

	// A fresh filter every time it opens.
	useEffect(() => {
		if (isOpen) setQuery("");
	}, [isOpen]);

	const typed = query.trim();
	const needle = typed.toLowerCase();
	const shown = tags.filter((tag) => tag.name.toLowerCase().includes(needle));
	const isNew =
		canCreate &&
		typed !== "" &&
		isInlineTagName(typed) &&
		!tags.some((tag) => tag.name.toLowerCase() === needle);

	/** Enter takes the first match, or makes the tag when there is none. */
	function takeFirst() {
		if (shown.length > 0) onPick(shown[0]);
		else if (isNew) onCreate(typed);
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title="Tag"
			subtitle={subtitle}
			width={380}
		>
			<VStack gap={3}>
				<TextInput
					autoComplete="off"
					label="Find a tag"
					isLabelHidden
					placeholder="Find a tag, then Enter"
					// Opened from the keyboard, so the keyboard carries on here.
					hasAutoFocus
					value={query}
					onChange={setQuery}
					onEnter={takeFirst}
					width="100%"
				/>

				{shown.length === 0 && !isNew ? (
					<EmptyState
						isCompact
						title="No matches"
						description={
							tags.length === 0
								? "There are no tags yet."
								: typed === ""
									? "There are no tags yet."
									: `No tag matches "${typed}".`
						}
					/>
				) : (
					// A space may have a great many tags; the list scrolls, the field
					// stays.
					<List hasDividers className="thunderlist-picker-list">
						{isNew ? (
							<ListItem
								startContent={<Icon icon={Plus} size="sm" color="accent" />}
								label={`Make #${typed}`}
								onClick={() => onCreate(typed)}
							/>
						) : null}
						{shown.map((tag) => (
							<ListItem
								key={tag.tagId}
								isSelected={current.includes(tag.tagId)}
								onClick={() => onPick(tag)}
								label={<Token size="sm" color={tag.color} label={tag.name} />}
								endContent={
									current.includes(tag.tagId) ? (
										<Icon icon={Check} size="sm" color="accent" />
									) : undefined
								}
							/>
						))}
					</List>
				)}

				<Text type="supporting">
					It is written into the title as #name, the way you would type it.
				</Text>
			</VStack>
		</FormDialog>
	);
}
