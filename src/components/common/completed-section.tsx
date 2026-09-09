import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Everything already done, kept below everything still to do.
 *
 * Completed work is worth seeing — it is the evidence the list is moving — but
 * not worth reading past every time, so it sits at the bottom under its own
 * heading with one control to clear it out.
 */
export function CompletedSection({
	count,
	clearLabel,
	onClear,
	children,
}: {
	count: number;
	/** Says what clearing does, which differs between a checklist and a list. */
	clearLabel: string;
	onClear: () => void;
	children: ReactNode;
}) {
	if (count === 0) return null;

	return (
		<VStack gap={2}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<Text type="label" weight="semibold" color="secondary">
					Completed · {count}
				</Text>
				<Button
					label={clearLabel}
					variant="ghost"
					size="sm"
					icon={<Trash2 aria-hidden />}
					onClick={onClear}
				/>
			</HStack>
			<Card padding={0}>
				<VStack gap={0} paddingInline={4} paddingBlock={2}>
					{children}
				</VStack>
			</Card>
		</VStack>
	);
}
