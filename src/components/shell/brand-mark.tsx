import { Text } from "@astryxdesign/core/Text";

/** The Thunderlist wordmark: a blue tile with a T, then the product name. */
export function BrandMark() {
	return (
		<span className="flex items-center gap-2">
			<svg
				width="22"
				height="22"
				viewBox="0 0 22 22"
				role="img"
				aria-label="Thunderlist"
				className="shrink-0"
			>
				<rect width="22" height="22" rx="6" fill="var(--color-accent)" />
				<path
					d="M5.6 6.2h10.8v2.4h-4.2v7.3H9.8V8.6H5.6z"
					fill="var(--color-on-accent)"
				/>
			</svg>
			<Text type="label" weight="semibold">
				Thunderlist
			</Text>
		</span>
	);
}
