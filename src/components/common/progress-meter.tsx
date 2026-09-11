import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import type { CSSProperties } from "react";
import { clampPercent } from "#/lib/progress";

/**
 * How many tasks should be done by now: "6 tasks". The `expectedReading` for
 * anything counted in tasks — a checklist, a tag, the day.
 *
 * Rounded to a whole task, since a task is either done or not. A tracker's
 * reading keeps a decimal place because "2.5 km" is a real distance.
 */
export function formatExpectedTasks(elapsed: number, total: number): string {
	const tasks = Math.round(elapsed * total);
	return `${tasks} ${tasks === 1 ? "task" : "tasks"}`;
}

/**
 * A progress bar with the pace target drawn on it.
 *
 * The target is the point the work should have reached by today, given its
 * start date and deadline. It is both the app's bolt, standing on the track
 * with its point on the spot, and a line of text underneath: the bolt alone
 * only says what it means on hover, which is no use on a phone and no use to
 * anyone reading with a screen reader. The same bolt leads the text, so the two
 * read as the mark and its key.
 *
 * With no deadline there is no target, and none is invented.
 *
 * On a phone the footnote and the target rarely fit side by side, so the target
 * drops onto a line of its own instead of both being squeezed into ragged
 * halves. The gap matches the one above, so the bar and the two lines stay
 * evenly spaced.
 */
export function ProgressMeter({
	label,
	percent,
	elapsed,
	expectedReading,
	footnote,
}: {
	/** Accessible name for the bar; never shown. */
	label: string;
	percent: number;
	/**
	 * How much of the time has gone, 0-1: where the work should be by now.
	 * `null` with nothing to measure against. `undefined` while the browser has
	 * yet to read its clock, when the room for the mark is kept so it does not
	 * push the bar down as it arrives; see `usePace`.
	 */
	elapsed: number | null | undefined;
	/**
	 * The same point in the work's own unit — "13 videos" — shown beside the
	 * percentage, so the target says what to reach and not only how far along.
	 */
	expectedReading?: string;
	footnote: string;
}) {
	const expectedPercent = elapsed == null ? null : elapsed * 100;
	const expected =
		expectedPercent === null ? null : clampPercent(expectedPercent);
	const reading = expectedReading === undefined ? "" : ` (${expectedReading})`;

	return (
		<VStack gap={1.5}>
			{/* How the bolt's point is placed is in `.thunderlist-meter`. */}
			<div className="thunderlist-meter" data-has-target={elapsed !== null}>
				<ProgressBar label={label} isLabelHidden value={percent} />
				{expectedPercent === null ? null : (
					<img
						src="/logo.svg"
						alt=""
						title={`${expected}%${reading} expected by now`}
						className="thunderlist-meter-target"
						// Unrounded: the point goes on the exact spot, not on the whole
						// percent the text beneath rounds it to.
						style={
							{
								"--thunderlist-target-at": `${Math.min(100, Math.max(0, expectedPercent))}%`,
							} as CSSProperties
						}
					/>
				)}
			</div>

			<HStack gap={1.5} hAlign="between" vAlign="center" wrap="wrap">
				<Text type="supporting">{footnote}</Text>

				{expected === null ? null : (
					<HStack gap={1} vAlign="center">
						<img
							src="/logo.svg"
							alt=""
							width={14}
							height={14}
							className="thunderlist-meter-key"
						/>
						<Text type="supporting">
							{expected}%{reading} expected by now
						</Text>
					</HStack>
				)}
			</HStack>
		</VStack>
	);
}
