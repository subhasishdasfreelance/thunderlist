import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import type { CSSProperties } from "react";
import { clampPercent } from "#/lib/progress";
import type { StagePart } from "#/schemas/checklist";
import { StageDot, stageColorStyle } from "./stage-dot";

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

/** "3 tasks", "1 task". */
function countTasks(count: number): string {
	return `${count} ${count === 1 ? "task" : "tasks"}`;
}

/** A part's share of the whole, as the hover over it says it: "30% Done". */
function shareOf(count: number, total: number, name: string): string {
	const percent = total === 0 ? 0 : Math.round((count / total) * 100);
	return `${percent}% ${name} · ${countTasks(count)}`;
}

/**
 * A checklist's bar in parts, a part a stage: done from the left, then each
 * stage before it, each as wide as its share of the tasks — so where each part
 * ends reads as "this many at least this far along". What is left of the
 * track is the first stage, the work not started. See `.thunderlist-stage-bar`.
 *
 * Pointing at a part, the track included, says its share of the whole.
 */
function StageBar({
	label,
	percent,
	parts,
	total,
	firstName,
	notStarted,
}: {
	label: string;
	percent: number;
	parts: ReadonlyArray<StagePart>;
	total: number;
	firstName: string;
	notStarted: number;
}) {
	const drawn = total === 0 ? [] : parts.filter((part) => part.count > 0);

	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percent}
			aria-valuetext={[
				`${percent}% done`,
				...parts
					.slice(1)
					.filter((part) => part.count > 0)
					.map((part) => `${countTasks(part.count)} at ${part.name}`),
			].join(", ")}
			className="thunderlist-stage-bar"
		>
			{drawn.map((part, index) => (
				<Tooltip
					key={part.stageId}
					content={shareOf(part.count, total, part.name)}
					delay={0}
					touchTrigger="tap"
				>
					<span
						className="thunderlist-stage-bar-part"
						data-last={index === drawn.length - 1}
						style={{
							...stageColorStyle(part.color),
							flexBasis: `${(part.count / total) * 100}%`,
						}}
					/>
				</Tooltip>
			))}
			{/* The empty track: the work not started, pointed at like the rest. */}
			{total === 0 || notStarted <= 0 ? null : (
				<Tooltip
					content={shareOf(notStarted, total, firstName)}
					delay={0}
					touchTrigger="tap"
				>
					<span className="thunderlist-stage-bar-rest" />
				</Tooltip>
			)}
		</div>
	);
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
 * A checklist's bar is drawn in parts, a colour a stage, with a key under it
 * naming each whenever there is more than the one; see `StageBar`.
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
	stages,
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
	/** A line under the bar, such as when it is due. Nothing for none. */
	footnote?: string | null;
	/**
	 * A checklist's stages, done first, and how many tasks it has in all: the
	 * bar is drawn in their colours; see `stageParts`.
	 */
	stages?: {
		parts: ReadonlyArray<StagePart>;
		total: number;
		/**
		 * What the first stage is called — the work not started, which is the
		 * bar's empty track rather than a part of it. Named here so the key can
		 * count it with the rest; how many are at it is whatever the parts leave
		 * over, so the two can never disagree.
		 */
		firstName?: string;
	};
}) {
	const expectedPercent = elapsed == null ? null : elapsed * 100;
	// What the parts leave over: the tasks still at the first stage.
	const notStarted =
		stages === undefined
			? 0
			: stages.total - stages.parts.reduce((sum, part) => sum + part.count, 0);
	const expected =
		expectedPercent === null ? null : clampPercent(expectedPercent);
	const reading = expectedReading === undefined ? "" : ` (${expectedReading})`;
	const hasFootnote = footnote != null && footnote !== "";

	return (
		<VStack gap={1.5}>
			{/* How the bolt's point is placed is in `.thunderlist-meter`. */}
			<div className="thunderlist-meter" data-has-target={elapsed !== null}>
				{stages === undefined ? (
					<ProgressBar label={label} isLabelHidden value={percent} />
				) : (
					<StageBar
						label={label}
						percent={percent}
						parts={stages.parts}
						total={stages.total}
						firstName={stages.firstName ?? "Not started"}
						notStarted={notStarted}
					/>
				)}
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

			{/*
			 * The key: a stage's colour is never the only thing naming it, and
			 * every stage is counted. It reads in the order a task travels — the
			 * first stage, drawn as the empty ring its empty track deserves, then
			 * each after it, done last — whatever order the bar draws them in.
			 */}
			{stages === undefined ||
			(stages.firstName === undefined && stages.parts.length < 2) ? null : (
				<HStack gap={3} vAlign="center" wrap="wrap">
					{stages.firstName === undefined ? null : (
						<HStack gap={1} vAlign="center">
							<StageDot color={null} />
							<Text type="supporting">
								{stages.firstName} {notStarted}
							</Text>
						</HStack>
					)}
					{[...stages.parts].reverse().map((part) => (
						<HStack key={part.stageId} gap={1} vAlign="center">
							<StageDot color={part.color} />
							<Text type="supporting">
								{part.name} {part.count}
							</Text>
						</HStack>
					))}
				</HStack>
			)}

			{!hasFootnote && expected === null ? null : (
				<HStack gap={1.5} hAlign="between" vAlign="center" wrap="wrap">
					{hasFootnote ? <Text type="supporting">{footnote}</Text> : <span />}

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
			)}
		</VStack>
	);
}
