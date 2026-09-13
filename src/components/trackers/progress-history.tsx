import { Card } from "@astryxdesign/core/Card";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { List, ListItem } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { MoreHorizontal } from "lucide-react";
import { ListPagination } from "#/components/common/list-pagination";
import { SectionSpinner } from "#/components/common/section-spinner";
import { formatDate } from "#/lib/format-date";
import { usePages } from "#/lib/use-pages";
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
								label={`${entry.value} ${unit}`}
								description={
									entry.note === ""
										? formatDate(entry.recordedAt)
										: `${formatDate(entry.recordedAt)} · ${entry.note}`
								}
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
																	onClick: () => onEdit(entry),
																},
															]
														: []),
													...(canDelete
														? [
																{
																	label: "Delete entry",
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
