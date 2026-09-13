import { EmptyState } from "@astryxdesign/core/EmptyState";
import { List, ListItem } from "@astryxdesign/core/List";
import { VStack } from "@astryxdesign/core/Stack";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import type { Checklist } from "#/schemas/checklist";

/**
 * Pick a checklist, for moving a task into it.
 *
 * A list with a filter above it rather than a menu: past a dozen checklists a
 * menu is something to scroll through, and two letters of a name are quicker.
 */
export function ChecklistPickerDialog({
	isOpen,
	onOpenChange,
	title,
	subtitle,
	checklists,
	isLoading,
	onPick,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	title: string;
	subtitle?: string;
	/** The checklists on offer: every one but the one it is already in. */
	checklists: ReadonlyArray<Pick<Checklist, "checklistId" | "title">>;
	/** The checklists are still on their way. */
	isLoading: boolean;
	onPick: (checklistId: string) => void;
}) {
	const [query, setQuery] = useState("");

	// A fresh filter every time it opens.
	useEffect(() => {
		if (isOpen) setQuery("");
	}, [isOpen]);

	const needle = query.trim().toLowerCase();
	const shown = checklists.filter((checklist) =>
		checklist.title.toLowerCase().includes(needle),
	);

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={title}
			subtitle={subtitle}
		>
			<VStack gap={3}>
				<TextInput
					label="Find a checklist"
					isLabelHidden
					placeholder="Find a checklist"
					value={query}
					onChange={setQuery}
					isLoading={isLoading}
				/>

				{checklists.length === 0 ? (
					isLoading ? null : (
						<EmptyState
							isCompact
							title="No other checklists."
							description="Create another checklist to move tasks into it."
						/>
					)
				) : shown.length === 0 ? (
					<EmptyState
						isCompact
						title="No matches"
						description={`No checklist matches "${query.trim()}".`}
					/>
				) : (
					<List hasDividers>
						{shown.map((checklist) => (
							<ListItem
								key={checklist.checklistId}
								label={checklist.title}
								onClick={() => onPick(checklist.checklistId)}
							/>
						))}
					</List>
				)}
			</VStack>
		</FormDialog>
	);
}
