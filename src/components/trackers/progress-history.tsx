import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { numberTitle } from "#/components/common/item-number";
import { ListPagination } from "#/components/common/list-pagination";
import { SectionSpinner } from "#/components/common/section-spinner";
import { ShortcutKey, TASK_SHORTCUTS } from "#/components/tasks/task-actions";
import { formatDate } from "#/lib/format-date";
import { useFocusRow } from "#/lib/use-focus-task";
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
	focusEntryId,
	picked,
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
	/**
	 * The reading search sent you to: its page of the history is opened, and it
	 * is scrolled to and ringed; see `useFocusRow`.
	 */
	focusEntryId?: string;
	/**
	 * The readings picked out, to be deleted together; see `useTaskSelection`
	 * and `PickBar`.
	 */
	picked?: ReadonlySet<string>;
}) {
	const history = [...entries].reverse();
	const paging = usePages(
		history,
		history.findIndex((entry) => entry.entryId === focusEntryId),
	);
	useFocusRow("data-entry-id", focusEntryId);
	const team = useTeam();
	// The reading under the pointer answers to the keys a task does: E edits
	// it, D deletes it.
	const [hovered, setHovered] = useState<ProgressEntry | null>(null);
	const shortcuts = useMemo(() => {
		const keys: RowShortcuts = {};
		if (hovered === null) return keys;
		if (canEdit) keys[TASK_SHORTCUTS.edit] = () => onEdit(hovered);
		if (canDelete) keys[TASK_SHORTCUTS.delete] = () => onDelete(hovered);
		return keys;
	}, [hovered, canEdit, canDelete, onEdit, onDelete]);
	useRowShortcuts(hovered !== null, shortcuts);

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
				// Laid out like a checklist's tasks — the same card, rules, padding
				// and type — so a reading reads as a row of the same kind.
				<Card padding={0}>
					<VStack gap={0} paddingBlock={2}>
						{paging.shown.map((entry, index) => (
							// biome-ignore lint/a11y/noStaticElementInteractions: resting the pointer here only arms the keyboard shortcuts; every action is also in the menu.
							<div
								key={entry.entryId}
								className="thunderlist-row thunderlist-entry-row"
								data-entry-id={entry.entryId}
								data-focused={entry.entryId === focusEntryId}
								data-picked={picked?.has(entry.entryId) === true}
								onMouseEnter={() => setHovered(entry)}
								onMouseLeave={() => setHovered(null)}
							>
								{index === 0 ? null : <Divider />}
								<div className="flex items-center gap-2 py-1.5">
									<VStack gap={0} className="min-w-0 flex-1">
										<Text>{`${entry.value} ${unit}`}</Text>
										<Text type="supporting">
											{[
												formatDate(entry.recordedAt),
												loggedBy(entry.recordedBy),
											]
												.filter((part) => part !== null)
												.join(" · ")}
										</Text>
										{/* On lines of its own, as it was written. */}
										{entry.note === "" ? null : (
											<Text type="supporting" className="thunderlist-multiline">
												{entry.note}
											</Text>
										)}
									</VStack>
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
													// Headed by its number; see `numberTitle`.
													...(canEdit
														? [
																{
																	type: "section" as const,
																	title: numberTitle("entry", entry.number),
																	items: [
																		{
																			label: "Edit entry",
																			icon: Pencil,
																			endContent: (
																				<ShortcutKey
																					label={TASK_SHORTCUTS.edit}
																				/>
																			),
																			onClick: () => onEdit(entry),
																		},
																	],
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
																	endContent: (
																		<ShortcutKey
																			label={TASK_SHORTCUTS.delete}
																		/>
																	),
																	variant: "destructive" as const,
																	onClick: () => onDelete(entry),
																},
															]
														: []),
												]}
											/>
										) : null}
									</HStack>
								</div>
							</div>
						))}
						<ListPagination
							page={paging.page}
							total={paging.total}
							onChange={paging.setPage}
						/>
					</VStack>
				</Card>
			)}
		</VStack>
	);
}
