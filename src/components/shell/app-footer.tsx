import { Text } from "@astryxdesign/core/Text";
import { BrandMark } from "./brand-mark";

/**
 * The foot of every page: the wordmark and what the app is for, and the
 * copyright, under a hairline.
 *
 * It sits in the same column as the page above it, so its edges line up with
 * the content rather than the window; see `.thunderlist-footer`.
 */
export function AppFooter() {
	return (
		<footer className="thunderlist-container thunderlist-footer">
			<div className="thunderlist-footer-inner">
				<div className="flex flex-col items-center gap-1.5 sm:items-start">
					<BrandMark />
					<Text type="supporting" color="secondary">
						Your day, your lists, your pace.
					</Text>
				</div>
				<Text type="supporting" color="secondary">
					© 2026 Thunderlist. All rights reserved.
				</Text>
			</div>
		</footer>
	);
}
