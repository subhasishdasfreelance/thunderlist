import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { ChevronRight, Trash2 } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { type ProgressView, ViewToggle } from "#/components/common/view-toggle";

/**
 * Everything already done, kept below everything still to do.
 *
 * Completed work is worth seeing — it is the evidence the list is moving — but
 * not worth reading past every time, so it sits at the bottom under its own
 * heading with one control to clear it out.
 *
 * It starts folded. The heading keeps the count, which is the part worth
 * seeing every time; the rows are for the occasional look back, and a long tail
 * of them pushed everything under the list off the screen.
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
	onOpen,
	chart,
	children,
}: {
	count: number;
	/** Says what clearing does, which differs between a checklist and a list. */
	clearLabel: string;
	/** Left out while the finished tasks have not been read, so none are shown. */
	onClear?: () => void;
	/** Opened for the first time: the finished tasks are read then, not before. */
	onOpen?: () => void;
	/** The same history as a graph. Without one there is nothing to toggle. */
	chart?: ReactNode;
	children: ReactNode;
}) {
	const [view, setView] = useState<ProgressView>("list");
	const [isOpen, setIsOpen] = useState(false);
	const contentId = useId();

	if (count === 0) return null;

	const showChart = chart !== undefined && view === "chart";

	return (
		<VStack gap={0}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<button
					type="button"
					className="thunderlist-disclosure"
					aria-expanded={isOpen}
					aria-controls={contentId}
					onClick={() => {
						if (!isOpen) onOpen?.();
						setIsOpen(!isOpen);
					}}
				>
					<ChevronRight
						aria-hidden
						size={16}
						className="thunderlist-disclosure-chevron"
					/>
					<Text type="label" weight="semibold" color="secondary">
						Completed · {count}
					</Text>
				</button>
				<HStack gap={1} vAlign="center">
					{chart === undefined || !isOpen ? null : (
						<ViewToggle
							view={view}
							onChange={setView}
							label="Show completed work as a list or a graph"
						/>
					)}
					{onClear === undefined ? null : (
						<Button
							label={clearLabel}
							variant="ghost"
							size="sm"
							icon={<Trash2 aria-hidden />}
							onClick={onClear}
						/>
					)}
				</HStack>
			</HStack>

			{/*
			 * Mounted while folded, so opening it has something to unfold; `inert`
			 * keeps the hidden rows out of the tab order and away from a screen
			 * reader until then. See `.thunderlist-collapse`.
			 */}
			<div
				id={contentId}
				className="thunderlist-collapse"
				data-open={isOpen}
				inert={!isOpen}
			>
				<div>
					<div className="thunderlist-collapse-body">
						{showChart ? (
							<Card padding={3}>{chart}</Card>
						) : (
							<Card padding={0}>
								<VStack gap={0} paddingBlock={2}>
									{children}
								</VStack>
							</Card>
						)}
					</div>
				</div>
			</div>
		</VStack>
	);
}
