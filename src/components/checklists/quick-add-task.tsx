import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack } from "@astryxdesign/core/Stack";
import { Plus } from "lucide-react";
import { useState } from "react";
import { TagTextField } from "#/components/tags/tag-text-field";
import { type ParsedTitle, parseInlineTags } from "#/lib/tags/inline-tags";
import type { Tag } from "#/schemas/tag";

/** Enough rows to see a pasted list without the field taking over the screen. */
const MAX_ROWS = 8;

/**
 * Two, not one.
 *
 * A single row is shorter than the hint written in it, so on a narrow screen
 * the placeholder was cut off mid-sentence with no way to read the rest. Two
 * rows fit it, and they also say without saying it that more than one line is
 * expected here.
 */
const MIN_ROWS = 2;

/** One task per non-blank line, each split into its title and its tags. */
function parseLines(value: string): Array<ParsedTitle> {
	return value
		.split("\n")
		.map((line) => parseInlineTags(line))
		.filter((parsed) => parsed.title !== "" || parsed.tagNames.length > 0)
		.filter((parsed) => parsed.title !== "");
}

/** How many lines are in the field, so it grows with a pasted list. */
function countLines(value: string): number {
	return value.split("\n").length;
}

/**
 * Add tasks without opening anything.
 *
 * Tasks have no due date and no notes, so a dialog would ask for one field and
 * charge two clicks and a context switch for it. This stays focused after each
 * add, which is what makes emptying your head into a list actually work.
 *
 * A newline is a task boundary, so a list written or copied from somewhere else
 * can be pasted in one go and lands as one task per line. That is the reason
 * this is a text area and not a single-line input: an `<input>` flattens a
 * multi-line paste into one line and the boundaries are lost before the app
 * ever sees them. Enter still adds; Shift+Enter starts another line by hand.
 *
 * Tags are written in the same breath — "buy milk #shopping" — and completed as
 * they are typed.
 */
export function QuickAddTask({
	placeholder = "Add a task — #tag it, or paste a list",
	tags,
	onAdd,
}: {
	placeholder?: string;
	/** Every tag that exists, for completing what is typed after a `#`. */
	tags: ReadonlyArray<Tag>;
	onAdd: (lines: Array<ParsedTitle>) => void;
}) {
	const [value, setValue] = useState("");
	const lines = parseLines(value);

	function add() {
		if (lines.length === 0) return;
		onAdd(lines);
		setValue("");
	}

	const label = lines.length > 1 ? `Add ${lines.length} tasks` : "Add task";

	return (
		<HStack gap={2} vAlign="start">
			<TagTextField
				label={placeholder}
				placeholder={placeholder}
				value={value}
				onChange={setValue}
				onSubmit={add}
				tags={tags}
				multiline
				rows={Math.min(Math.max(countLines(value), MIN_ROWS), MAX_ROWS)}
			/>
			<IconButton
				label={label}
				tooltip={label}
				variant="primary"
				icon={<Plus aria-hidden />}
				isDisabled={lines.length === 0}
				onClick={add}
			/>
		</HStack>
	);
}
