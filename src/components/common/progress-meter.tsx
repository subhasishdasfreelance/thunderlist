import { Icon } from "@astryxdesign/core/Icon";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Flag } from "lucide-react";
import { clampPercent } from "#/lib/progress";

/**
 * A progress bar with the pace target drawn on it.
 *
 * The target is the point the work should have reached by today, given its
 * start date and deadline. It is both a tick on the track and a line of text
 * underneath: the tick alone only says what it means on hover, which is no use
 * on a phone and no use to anyone reading with a screen reader.
 *
 * With no deadline there is no target, and none is invented.
 */
export function ProgressMeter({
	label,
	percent,
	expectedPercent,
	expectedReading,
	footnote,
}: {
	/** Accessible name for the bar; never shown. */
	label: string;
	percent: number;
	/** Where the work should be by now, 0-100, or `null` with no deadline. */
	expectedPercent: number | null;
	/**
	 * The same point in the work's own unit — "13 videos" — shown beside the
	 * percentage, so the target says what to reach and not only how far along.
	 */
	expectedReading?: string;
	footnote: string;
}) {
	const expected =
		expectedPercent === null ? null : clampPercent(expectedPercent);
	const reading = expectedReading === undefined ? "" : ` (${expectedReading})`;

	return (
		<VStack gap={1.5}>
			<ProgressBar
				label={label}
				isLabelHidden
				value={percent}
				marks={
					expected === null
						? undefined
						: [
								{
									value: expected,
									label: `${expected}%${reading} expected by now`,
								},
							]
				}
			/>

			<HStack gap={2} hAlign="between" vAlign="center">
				<Text type="supporting">{footnote}</Text>

				{expected === null ? null : (
					<HStack gap={1} vAlign="center">
						<Icon icon={Flag} size="sm" color="secondary" />
						<Text type="supporting">
							{expected}%{reading} expected by now
						</Text>
					</HStack>
				)}
			</HStack>
		</VStack>
	);
}
