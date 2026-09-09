import { Card } from "@astryxdesign/core/Card";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { List, ListItem } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { formatDate } from "#/lib/format-date";
import type { ProgressEntry } from "#/schemas/tracker";

/**
 * A tracker's readings, newest first — the most recent one is what people come
 * here to look for.
 *
 * Each row shows the reading and the step it represents. The step is what a
 * progress chart is drawn from, and showing it here is what makes "enter where
 * you are, not how far you got" legible: you can see what the app worked out.
 */
export function ProgressHistory({
	entries,
	unit,
	onEdit,
	onDelete,
}: {
	/** Oldest first, as stored; this reverses them for display. */
	entries: ReadonlyArray<ProgressEntry>;
	unit: string;
	onEdit: (entry: ProgressEntry) => void;
	onDelete: (entry: ProgressEntry) => void;
}) {
	const history = [...entries].reverse();

	return (
		<VStack gap={2}>
			<Text type="label" weight="semibold">
				Progress History
			</Text>

			{history.length === 0 ? (
				<EmptyState
					isCompact
					title="No progress yet."
					description="Add your first entry to start the history."
				/>
			) : (
				<Card padding={0}>
					<List hasDividers>
						{history.map((entry) => (
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
										<DropdownMenu
											hasChevron={false}
											placement="below"
											alignment="end"
											button={{
												label: `Actions for entry on ${formatDate(entry.recordedAt)}`,
												variant: "ghost",
												size: "sm",
											}}
											items={[
												{ label: "Edit entry", onClick: () => onEdit(entry) },
												{
													label: "Delete entry",
													variant: "destructive" as const,
													onClick: () => onDelete(entry),
												},
											]}
										/>
									</HStack>
								}
							/>
						))}
					</List>
				</Card>
			)}
		</VStack>
	);
}
