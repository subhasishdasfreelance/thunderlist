import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Stack";
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
 * Every screen that answers "how is this going" answers it the same way, so the
 * labels sit in the same places and can be compared at a glance. Figures wrap
 * rather than shrink, because a truncated number is worse than a second line.
 */
export function StatGrid({ stats }: { stats: ReadonlyArray<Stat> }) {
	if (stats.length === 0) return null;

	return (
		<Card padding={3}>
			<HStack gap={4} wrap="wrap" hAlign="between">
				{stats.map((stat) => (
					<VStack key={stat.label} gap={0.5}>
						<Text type="supporting">{stat.label}</Text>
						<Text weight="medium">{stat.value}</Text>
						{stat.hint ? <Text type="supporting">{stat.hint}</Text> : null}
					</VStack>
				))}
			</HStack>
		</Card>
	);
}
