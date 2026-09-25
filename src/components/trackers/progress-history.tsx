import { Card } from "@astryxdesign/core/Card";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { List, ListItem } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ListPagination } from "#/components/common/list-pagination";
import { SectionSpinner } from "#/components/common/section-spinner";
import { ShortcutKey, TASK_SHORTCUTS } from "#/components/tasks/task-actions";
import { formatDate } from "#/lib/format-date";
import { usePages } from "#/lib/use-pages";
import { type RowShortcuts, useRowShortcuts } from "#/lib/use-row-shortcuts";
import { useTeam } from "#/lib/use-team";
import { memberName } from "#/schemas/team";
import type { ProgressEntry } from "#/schemas/tracker";

/**
 * A tracker's readings, newest first — the most recent one is what people come
 * here to look for.
 *
 * Each row shows the reading and the step it represents. The step is what the
 * chart is drawn from, and showing it here is what makes "enter where you are,
 * not how far you got" legible: you can see what the app worked out.
 *
 * The history is loaded after the figures at the top of the screen, so this
 * carries its own waiting state rather than holding the whole page back.
 */
export function ProgressHistory({
	entries,
	unit,
	isPending,
	canEdit = true,
	canDelete = true,
	onEdit,
	onDelete,
}: {
	/** Oldest first, as stored; this reverses them for display. */
	entries: ReadonlyArray<ProgressEntry>;
	unit: string;
	/** The entries are still on their way. */
	isPending: boolean;
	/** Whether a reading can be corrected — in a team, anyone who updates work. */
	canEdit?: boolean;
	/** Whether a reading can be deleted — in a team, a project manager's call. */
	canDelete?: boolean;
	onEdit: (entry: ProgressEntry) => void;
	onDelete: (entry: ProgressEntry) => void;
}) {
	const history = [...entries].reverse();
	const paging = usePages(history);
	const team = useTeam();
	// The reading under the pointer answers to the keys a task does: E edits it.
	const [hovered, setHovered] = useState<ProgressEntry | null>(null);
	const shortcuts = useMemo(() => {
		const keys: RowShortcuts = {};
		if (hovered !== null) keys[TASK_SHORTCUTS.edit] = () => onEdit(hovered);
		return keys;
	}, [hovered, onEdit]);
	useRowShortcuts(hovered !== null && canEdit, shortcuts);

	/** In a team, who logged it: their name, or their address until they have one. */
	const loggedBy = (email: string | null | undefined) => {
		if (team === null || !email) return null;
		const member = team.members.find((each) => each.email === email);
		return member === undefined ? email : memberName(member);
	};

	return (
		<VStack gap={2}>
			{isPending ? (
				<SectionSpinner label="Loading history…" />
			) : history.length === 0 ? (
				<EmptyState
					isCompact
					title="No progress yet."
					description="Add your first entry to start the history."
				/>
			) : (
				<Card padding={0}>
					<List hasDividers>
						{paging.shown.map((entry) => (
							<ListItem
								key={entry.entryId}
								onMouseEnter={() => setHovered(entry)}
								onMouseLeave={() => setHovered(null)}
								label={`${entry.value} ${unit}`}
								description={[
									formatDate(entry.recordedAt),
									loggedBy(entry.recordedBy),
									entry.note === "" ? null : entry.note,
								]
									.filter((part) => part !== null)
									.join(" · ")}
								endContent={
									<HStack gap={2} vAlign="center">
										<Text type="supporting" color="secondary">
											{entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
										</Text>
										{/* No menu at all rather than one with nothing in it. */}
										{canEdit || canDelete ? (
											<DropdownMenu
												hasChevron={false}
												placement="below"
												alignment="end"
												button={{
													label: `Actions for entry on ${formatDate(entry.recordedAt)}`,
													variant: "ghost",
													size: "sm",
													isIconOnly: true,
													icon: <MoreHorizontal aria-hidden />,
												}}
												items={[
													...(canEdit
														? [
																{
																	label: "Edit entry",
																	icon: Pencil,
																	endContent: (
																		<ShortcutKey label={TASK_SHORTCUTS.edit} />
																	),
																	onClick: () => onEdit(entry),
																},
															]
														: []),
													// Apart from editing, when there is both.
													...(canEdit && canDelete
														? [{ type: "divider" as const }]
														: []),
													...(canDelete
														? [
																{
																	label: "Delete entry",
																	icon: <Trash2 aria-hidden />,
																	variant: "destructive" as const,
																	onClick: () => onDelete(entry),
																},
															]
														: []),
												]}
											/>
										) : null}
									</HStack>
								}
							/>
						))}
					</List>
					<ListPagination
						page={paging.page}
						total={paging.total}
						onChange={paging.setPage}
					/>
				</Card>
			)}
		</VStack>
	);
}
