import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TagTextField } from "#/components/tags/tag-text-field";
import type { Checklist } from "#/schemas/checklist";
import type { Tag } from "#/schemas/tag";
import type { TrackerSummary } from "#/schemas/tracker";

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

/**
 * The field a task is written in, wherever it is written.
 *
 * Adding a task and editing one are the same act on the same text, so they are
 * the same control: a text area that highlights the `#tags` and `&links` in
 * place, completes them as they are typed, and takes the height of whatever is
 * in it, between two rows and eight. Having one of these rather than two is
 * what keeps a task edited in the field it was written in — same size, same
 * completion, same keys — instead of the two drifting apart a prop at a time.
 *
 * It is a text area and not a one-line input even where only one task is being
 * written: an `<input>` flattens a multi-line paste into one line, and a long
 * title is then something to scroll along rather than read.
 */
export function TaskTitleField({
	label,
	placeholder,
	value,
	onChange,
	onSubmit,
	tags,
	trackers = [],
	checklists = [],
	hasAutoFocus = false,
	hint,
}: {
	/** Hidden, but the field's accessible name; see `TagTextField`. */
	label: string;
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
	/** Enter, when no suggestion is being chosen. */
	onSubmit: () => void;
	/** Every tag that exists, for completing what is typed after a `#`. */
	tags: ReadonlyArray<Tag>;
	/** Every tracker, for completing a line that begins `&`. */
	trackers?: ReadonlyArray<TrackerSummary>;
	/** The checklists a line beginning `&` may also name. */
	checklists?: ReadonlyArray<Pick<Checklist, "checklistId" | "title">>;
	hasAutoFocus?: boolean;
	/** A line under the field saying what can be written in it. */
	hint?: string;
}) {
	const field = (
		<TagTextField
			label={label}
			placeholder={placeholder}
			value={value}
			onChange={onChange}
			onSubmit={onSubmit}
			tags={tags}
			trackers={trackers}
			checklists={checklists}
			multiline
			minRows={MIN_ROWS}
			maxRows={MAX_ROWS}
			hasAutoFocus={hasAutoFocus}
		/>
	);

	if (hint === undefined) return field;

	return (
		<VStack gap={1}>
			{field}
			<Text type="supporting">{hint}</Text>
		</VStack>
	);
}
