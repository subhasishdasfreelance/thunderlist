import { FieldLabel } from "@astryxdesign/core/Field";
import { Markdown } from "@astryxdesign/core/Markdown";
import {
	SegmentedControl,
	SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { useId } from "react";

export type NotesView = "write" | "preview";

/**
 * A task's notes, written in Markdown.
 *
 * The edit dialog is the only place notes are ever shown, so it is where they
 * are read as well as written. That is why there is a preview at all, rather
 * than the raw text standing in for both.
 */
export function TaskNotesField({
	value,
	onChange,
	view,
	onViewChange,
}: {
	value: string;
	onChange: (value: string) => void;
	view: NotesView;
	onViewChange: (view: NotesView) => void;
}) {
	const labelFor = useId();

	return (
		<VStack gap={1}>
			<HStack gap={2} hAlign="between" vAlign="center">
				{/* Only the visible heading, drawn by Astryx so it matches the
				    caption's label. The text area carries its own hidden label, which
				    is what names it, and in preview there is no field to point at. */}
				<FieldLabel label="Notes" inputID={labelFor} isOptional />
				<SegmentedControl
					label="Show notes as"
					size="sm"
					value={view}
					onChange={(next) => onViewChange(next as NotesView)}
				>
					<SegmentedControlItem value="write" label="Write" />
					<SegmentedControlItem value="preview" label="Preview" />
				</SegmentedControl>
			</HStack>

			{view === "write" ? (
				<>
					<TextArea
						label="Notes"
						isLabelHidden
						rows={6}
						value={value}
						onChange={onChange}
						width="100%"
					/>
					<Text type="supporting">
						Markdown works here: **bold**, _italic_, lists, [links](https://…).
					</Text>
				</>
			) : value.trim() === "" ? (
				<Text type="supporting">No notes yet.</Text>
			) : (
				<Markdown
					density="compact"
					headingLevelStart={3}
					// A link opens beside the app, not in place of it: following one
					// here would otherwise throw away whatever else was being edited.
					onLinkClick={(href) => {
						window.open(href, "_blank", "noopener,noreferrer");
						return false;
					}}
				>
					{value}
				</Markdown>
			)}
		</VStack>
	);
}
