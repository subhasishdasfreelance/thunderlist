import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { type ProgressView, ViewToggle } from "#/components/common/view-toggle";

/**
 * Everything already done, kept below everything still to do.
 *
 * Completed work is worth seeing — it is the evidence the list is moving — but
 * not worth reading past every time, so it sits at the bottom under its own
 * heading with one control to clear it out.
 *
 * The same work answers a second question that the rows cannot: not *what* was
 * finished but *how fast*, against what was planned. That is the same history
 * seen from further back, so it is a view of this section rather than a section
 * of its own — no completed task is listed twice on the page.
 */
export function CompletedSection({
	count,
	clearLabel,
	onClear,
	chart,
	children,
}: {
	count: number;
	/** Says what clearing does, which differs between a checklist and a list. */
	clearLabel: string;
	onClear: () => void;
	/** The same history as a graph. Without one there is nothing to toggle. */
	chart?: ReactNode;
	children: ReactNode;
}) {
	const [view, setView] = useState<ProgressView>("list");

	if (count === 0) return null;

	const showChart = chart !== undefined && view === "chart";

	return (
		<VStack gap={2}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<Text type="label" weight="semibold" color="secondary">
					Completed · {count}
				</Text>
				<HStack gap={1} vAlign="center">
					{chart === undefined ? null : (
						<ViewToggle
							view={view}
							onChange={setView}
							label="Show completed work as a list or a graph"
						/>
					)}
					<Button
						label={clearLabel}
						variant="ghost"
						size="sm"
						icon={<Trash2 aria-hidden />}
						onClick={onClear}
					/>
				</HStack>
			</HStack>

			{showChart ? (
				<Card padding={3}>{chart}</Card>
			) : (
				<Card padding={0}>
					<VStack gap={0} paddingBlock={2}>
						{children}
					</VStack>
				</Card>
			)}
		</VStack>
	);
}
