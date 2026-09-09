import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useId, useMemo } from "react";

/**
 * A reading: how much had been done in total, and the moment it was true.
 *
 * The moment is a timestamp rather than a date so the same chart can draw a
 * project measured in weeks and a day measured in hours.
 *
 * `id` is the thing the reading came from — an entry, a task. Two readings can
 * land on the same spot on the chart (two tasks ticked in the same minute, two
 * entries recorded on one day at the same value), so the drawn position is not
 * something a dot can be identified by.
 */
export type ChartPoint = { id: string; at: number; value: number };

/** The drawing box. The SVG scales to its container; these are its proportions. */
const WIDTH = 640;
const HEIGHT = 240;
const PADDING = { top: 12, right: 12, bottom: 26, left: 40 };

const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

type Series = {
	key: string;
	label: string;
	colour: string;
	dashed: boolean;
	points: Array<[number, number]>;
};

/**
 * Progress over time: what was planned, what happened, and what is left to do.
 *
 * Three lines answer three different questions, so each is drawn differently
 * rather than relying on colour alone:
 *
 *   • **Planned** — the straight line from nothing on the start day to the
 *     target on the deadline. Dashed and grey: it is a reference, not a record.
 *   • **Followed** — what actually happened, in the accent. Solid, with a dot
 *     per reading, because these are the only points that are facts.
 *   • **Needed from now** — from where you stand today to the target on the
 *     deadline. Dashed and amber: it is the line to beat, and it only exists
 *     while there is still time.
 *
 * There is no chart library here. Three polylines and two axes are less code
 * than configuring one, and the result takes its colours from the theme tokens
 * like everything else.
 */
export function ProgressChart({
	start,
	end,
	now,
	target,
	base,
	current,
	points,
	startLabel,
	endLabel,
	summary,
}: {
	/** When the work began, as a timestamp. */
	start: number;
	/** The deadline, or `null` when there is none to be measured against. */
	end: number | null;
	/** The present moment, passed in so the chart is not its own clock. */
	now: number;
	/** The finishing line. */
	target: number;
	/**
	 * The floor of the vertical axis: what had already been done on day one.
	 *
	 * A book opened at page 40 and finished at page 80 is a chart of 40 pages,
	 * not 80, and drawing it from zero would squash the whole story into the top
	 * half of the picture.
	 */
	base?: number;
	/** Where things stand, which may be later than the last reading. */
	current: number;
	/** Cumulative readings, oldest first. */
	points: ReadonlyArray<ChartPoint>;
	startLabel: string;
	endLabel: string;
	/** Read out in place of the picture, for anyone who cannot see it. */
	summary: string;
}) {
	const titleId = useId();

	const floor = base ?? 0;

	const chart = useMemo(() => {
		// The axis runs from the start to whichever comes last: the deadline, now,
		// or the final reading. A chart that stopped before "now" would hide the
		// very gap it exists to show.
		const last = Math.max(end ?? start, now, points.at(-1)?.at ?? start);
		const span = Math.max(1, last - start);

		const ceiling = Math.max(
			target,
			current,
			...points.map((p) => p.value),
			floor + 1,
		);

		const x = (at: number) =>
			PADDING.left +
			(Math.min(Math.max(at - start, 0), span) / span) * PLOT_WIDTH;

		const height = ceiling - floor;
		const y = (value: number) =>
			PADDING.top +
			(1 - (Math.min(Math.max(value, floor), ceiling) - floor) / height) *
				PLOT_HEIGHT;

		const series: Array<Series> = [];

		if (end !== null) {
			series.push({
				key: "planned",
				label: "Planned",
				colour: "var(--color-border-emphasized)",
				dashed: true,
				points: [
					[x(start), y(floor)],
					[x(end), y(target)],
				],
			});
		}

		// The line starts at nothing on the first day, so the first reading reads
		// as a step up from zero rather than as a mark appearing in mid-air.
		const followed: Array<[number, number]> = [
			[x(start), y(floor)],
			...points.map((point): [number, number] => [x(point.at), y(point.value)]),
			[x(now), y(current)],
		];

		series.push({
			key: "followed",
			label: "Followed",
			colour: "var(--color-accent)",
			dashed: false,
			points: followed,
		});

		if (end !== null && current < target && now < end) {
			series.push({
				key: "needed",
				label: "Needed from now",
				colour: "var(--color-icon-orange)",
				dashed: true,
				points: [
					[x(now), y(current)],
					[x(end), y(target)],
				],
			});
		}

		return {
			series,
			ceiling,
			dots: points.map((point) => ({
				id: point.id,
				cx: x(point.at),
				cy: y(point.value),
			})),
		};
	}, [start, end, now, target, current, points, floor]);

	return (
		<VStack gap={2}>
			<svg
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				className="h-auto w-full"
				role="img"
				aria-labelledby={titleId}
				preserveAspectRatio="none"
			>
				<title id={titleId}>{summary}</title>

				{/* The two axes, drawn as one path so they share a stroke. */}
				<path
					d={`M ${PADDING.left} ${PADDING.top} V ${PADDING.top + PLOT_HEIGHT} H ${PADDING.left + PLOT_WIDTH}`}
					fill="none"
					stroke="var(--color-border)"
					strokeWidth={1}
					vectorEffect="non-scaling-stroke"
				/>

				{chart.series.map((line) => (
					<polyline
						key={line.key}
						points={line.points.map(([px, py]) => `${px},${py}`).join(" ")}
						fill="none"
						stroke={line.colour}
						strokeWidth={2}
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeDasharray={line.dashed ? "5 5" : undefined}
						vectorEffect="non-scaling-stroke"
					/>
				))}

				{chart.dots.map((dot) => (
					<circle
						key={dot.id}
						cx={dot.cx}
						cy={dot.cy}
						r={3}
						fill="var(--color-accent)"
					/>
				))}

				{/* Only the corners are labelled: a chart this size cannot carry a
				    full scale without the numbers colliding. */}
				<text
					x={PADDING.left - 6}
					y={PADDING.top + 4}
					textAnchor="end"
					fontSize={11}
					fill="var(--color-text-secondary)"
				>
					{chart.ceiling}
				</text>
				<text
					x={PADDING.left - 6}
					y={PADDING.top + PLOT_HEIGHT}
					textAnchor="end"
					fontSize={11}
					fill="var(--color-text-secondary)"
				>
					{floor}
				</text>
				<text
					x={PADDING.left}
					y={HEIGHT - 8}
					textAnchor="start"
					fontSize={11}
					fill="var(--color-text-secondary)"
				>
					{startLabel}
				</text>
				<text
					x={WIDTH - PADDING.right}
					y={HEIGHT - 8}
					textAnchor="end"
					fontSize={11}
					fill="var(--color-text-secondary)"
				>
					{endLabel}
				</text>
			</svg>

			<HStack gap={3} wrap="wrap">
				{chart.series.map((line) => (
					<HStack key={line.key} gap={1} vAlign="center">
						<span
							className="thunderlist-legend-key"
							data-dashed={line.dashed}
							style={{ color: line.colour }}
						/>
						<Text type="supporting">{line.label}</Text>
					</HStack>
				))}
			</HStack>
		</VStack>
	);
}
