import { Card } from "@astryxdesign/core/Card";
import { Text } from "@astryxdesign/core/Text";

export type Stat = {
	label: string;
	value: string;
	/** Shown under the value when the number alone does not explain itself. */
	hint?: string;
};

/**
 * A row of headline figures.
 *
 * Every screen that answers "how is this going" answers it the same way, in the
 * same order, so two screens can be compared without re-reading the labels.
 *
 * A grid rather than a wrapping row: with `flex-wrap` the columns land wherever
 * the text happens to end, so the same six figures line up differently on every
 * screen and the eye has to find them again each time. Two columns on a phone,
 * three on a tablet, all of them on a desktop — and the columns stay columns.
 *
 * The label, the figure and the hint sit on three rows shared by every cell, so
 * a label that wraps moves nothing but itself; see `.thunderlist-stats`.
 */
export function StatGrid({ stats }: { stats: ReadonlyArray<Stat> }) {
	if (stats.length === 0) return null;

	return (
		<Card padding={3}>
			<div className="thunderlist-stats">
				{stats.map((stat) => (
					<div className="thunderlist-stat" key={stat.label}>
						<Text type="supporting">{stat.label}</Text>
						<Text weight="medium">{stat.value}</Text>
						{stat.hint ? <Text type="supporting">{stat.hint}</Text> : <span />}
					</div>
				))}
			</div>
		</Card>
	);
}
