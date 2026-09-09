import { Card } from "@astryxdesign/core/Card";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import type { ReactNode } from "react";

/** One thing tasks can be grouped by: a tag, a priority band, "untagged". */
export type Facet = {
	value: string;
	label: string;
	/** The mark that already means this thing elsewhere in the app. */
	mark: ReactNode;
	total: number;
	done: number;
};

/**
 * Every group at a glance, above the one being read.
 *
 * A screen that groups tasks has two questions to answer, and they want
 * different shapes. "How is each group doing" is a comparison, so all of them
 * are on screen at once. "What is in this one" is a list, so only one is — the
 * other twelve would bury it.
 *
 * Each row carries the same mark it carries everywhere else — a tag's colour,
 * the bolt and star of a priority — so the summary and the list below it are
 * visibly about the same things.
 */
export function FacetSummary({
	facets,
	selected,
	onSelect,
}: {
	facets: ReadonlyArray<Facet>;
	selected: string;
	onSelect: (value: string) => void;
}) {
	if (facets.length === 0) return null;

	return (
		<Card padding={0}>
			<div className="thunderlist-facets">
				{facets.map((facet) => (
					<button
						key={facet.value}
						type="button"
						className="thunderlist-facet"
						data-selected={facet.value === selected}
						aria-pressed={facet.value === selected}
						onClick={() => onSelect(facet.value)}
					>
						<VStack gap={1}>
							<HStack gap={1.5} vAlign="center">
								{facet.mark}
								<Text type="supporting">{facet.label}</Text>
							</HStack>
							<HStack gap={1} vAlign="end">
								<Text weight="medium">{facet.total - facet.done}</Text>
								<Text type="supporting">
									{facet.total === 0 ? "none" : `left of ${facet.total}`}
								</Text>
							</HStack>
						</VStack>
					</button>
				))}
			</div>
		</Card>
	);
}
