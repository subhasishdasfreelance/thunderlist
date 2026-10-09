import type { ReactNode } from "react";

/**
 * A list's controls — its count, filters, tabs — on a pane of frosted glass,
 * so they read as part of the list rather than as text loose on the page's
 * background.
 *
 * Given the list as `children`, the pane is rounded at the top only and the
 * list's card tucks into its lower edge, so the pane seems to grow out of the
 * list. Without one — over a grid of cards, or while there is no list to
 * show — it stands on its own, rounded all round. With no `controls`, the
 * list is shown as it is.
 */
export function ListPanel({
	controls,
	children,
}: {
	controls: ReactNode;
	children?: ReactNode;
}) {
	if (controls === null || controls === false) return children;
	const hasList =
		children !== undefined && children !== null && children !== false;

	return (
		<div className="thunderlist-list-panel">
			<div
				className="thunderlist-list-head"
				data-attached={hasList || undefined}
			>
				{controls}
			</div>
			{!hasList ? null : (
				<div className="thunderlist-list-body">{children}</div>
			)}
		</div>
	);
}
