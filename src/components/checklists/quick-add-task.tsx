import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack } from "@astryxdesign/core/Stack";
import { Plus } from "lucide-react";
import { useState } from "react";
import { TaskTitleField } from "#/components/checklists/task-title-field";
import { type ParsedTitle, parseInlineTags } from "#/lib/tags/inline-tags";
import type { Checklist } from "#/schemas/checklist";
import type { Tag } from "#/schemas/tag";
import type { TrackerSummary } from "#/schemas/tracker";

/** One task per non-blank line, each split into its title and its tags. */
function parseLines(value: string): Array<ParsedTitle> {
	return value
		.split("\n")
		.map((line) => parseInlineTags(line))
		.filter((parsed) => parsed.title !== "" || parsed.tagNames.length > 0)
		.filter((parsed) => parsed.title !== "");
}

/**
 * Add tasks without opening anything.
 *
 * Tasks have no due date and no notes, so a dialog would ask for one field and
 * charge two clicks and a context switch for it. This stays focused after each
 * add, which is what makes emptying your head into a list actually work.
 *
 * A newline is a task boundary, so a list written or copied from somewhere else
 * can be pasted in one go and lands as one task per line — which is the reason
 * the field it is typed into is a text area; see `TaskTitleField`. Enter still
 * adds; Shift+Enter starts another line by hand.
 *
 * Tags are written in the same breath — "buy milk #shopping" — and completed as
 * they are typed. A line beginning `&` names a tracker or another checklist
 * instead: the task it makes is finished when that is, and cannot be ticked by
 * hand.
 */
export function QuickAddTask({
	placeholder = "Add a task — #tag it, &track it, or paste a list",
	tags,
	trackers = [],
	checklists = [],
	onAdd,
}: {
	placeholder?: string;
	/** Every tag that exists, for completing what is typed after a `#`. */
	tags: ReadonlyArray<Tag>;
	/** Every tracker, for completing a line that begins `&`. */
	trackers?: ReadonlyArray<TrackerSummary>;
	/** The checklists a line beginning `&` may also name. */
	checklists?: ReadonlyArray<Pick<Checklist, "checklistId" | "title">>;
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
			<TaskTitleField
				label={placeholder}
				placeholder={placeholder}
				value={value}
				onChange={setValue}
				onSubmit={add}
				tags={tags}
				trackers={trackers}
				checklists={checklists}
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
