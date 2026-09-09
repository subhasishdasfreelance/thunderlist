import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

/** What has happened to one queued change during a save. */
export type SaveState = "saved" | "saving" | "queued";

export type SaveProgress = {
	/** How many changes have been written, counted from the front. */
	saved: number;
	/** How many are in flight right now, immediately after those. */
	saving: number;
	/** The whole batch being saved. */
	total: number;
};

export const NOT_SAVING: SaveProgress = { saved: 0, saving: 0, total: 0 };

/** Where one change stands. The queue is written front to back, so index says it. */
export function stateAt(progress: SaveProgress, index: number): SaveState {
	if (index < progress.saved) return "saved";
	if (index < progress.saved + progress.saving) return "saving";
	return "queued";
}

/** A saved or in-flight change is already on its way; it cannot be taken back. */
export function isLocked(progress: SaveProgress, index: number): boolean {
	return stateAt(progress, index) !== "queued";
}

/**
 * How far a save has got.
 *
 * The bar is the honest measure — changes written, out of changes to write —
 * and it fills in steps of five, because that is the size of one batch. The
 * width transition is what turns those steps into movement rather than a jump.
 */
export function SaveProgressBar({ progress }: { progress: SaveProgress }) {
	const percent =
		progress.total === 0
			? 0
			: Math.round((progress.saved / progress.total) * 100);

	return (
		<VStack gap={1}>
			{/* ProgressBar eases its own width with the shared motion tokens, so the
			    jump from one pass of five to the next reads as movement. */}
			<ProgressBar label="Saving changes" isLabelHidden value={percent} />
			<HStack gap={2} hAlign="between" vAlign="center">
				<Text type="supporting">
					{progress.saving > 0
						? `Saving ${progress.saving} of ${progress.total}…`
						: `${progress.saved} of ${progress.total} saved`}
				</Text>
				<Text type="supporting">{percent}%</Text>
			</HStack>
		</VStack>
	);
}
