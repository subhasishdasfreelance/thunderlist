import { CheckboxIndicator } from "@astryxdesign/core/Indicator";
import type { ReactNode } from "react";

/**
 * A card, while its screen is picking; see `usePickMode`. Pressing it picks
 * it rather than opening it: the whole card is the checkbox, with a tick in
 * its corner, and a wash once it is picked.
 *
 * One that cannot be picked — the Inbox, the Backlog, Today, which are
 * everyone's and cannot be deleted — is drawn faint, and pressing it does
 * nothing, rather than opening it and leaving the pick behind.
 */
export function Pickable({
	isPicking,
	isPicked,
	isPickable = true,
	label,
	onToggle,
	children,
}: {
	isPicking: boolean;
	isPicked: boolean;
	isPickable?: boolean;
	/** What it is called, for a screen reader: its title. */
	label: string;
	onToggle: () => void;
	children: ReactNode;
}) {
	if (!isPicking) return children;

	return (
		<div
			className="thunderlist-pickable"
			data-picked={isPicked}
			data-pickable={isPickable}
		>
			{children}
			{isPickable ? (
				<label className="thunderlist-pickable-cover">
					<input
						type="checkbox"
						className="sr-only"
						aria-label={label}
						checked={isPicked}
						onChange={onToggle}
					/>
					<CheckboxIndicator
						state={isPicked ? "checked" : "unchecked"}
						size="md"
					/>
				</label>
			) : (
				<div className="thunderlist-pickable-cover" aria-hidden />
			)}
		</div>
	);
}
