import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Text } from "@astryxdesign/core/Text";
import { Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { TASK_SHORTCUTS } from "#/components/tasks/task-actions";
import { usePickKeys } from "#/lib/use-pick-keys";

/**
 * The bar over anything picked out but tasks — a tracker's readings, or the
 * checklists, trackers, tags, plans or countdowns on their screens; see
 * `useTaskSelection`. Tasks have a bar of their own with far more on it; see
 * `SelectionBar`.
 *
 * It floats at the foot of the screen as theirs does, and D deletes what is
 * picked as it deletes one, once the page has asked. Escape closes it.
 */
export function PickBar({
	count,
	noun,
	onDelete,
	children,
	onClear,
}: {
	count: number;
	/** What is picked, one and several: `["reading", "readings"]`. */
	noun: readonly [string, string];
	/** Delete them all, once the page has asked. Left out where they may not be. */
	onDelete?: () => void;
	/** Anything else that can be done to them all, as buttons. */
	children?: ReactNode;
	onClear: () => void;
}) {
	usePickKeys({ [TASK_SHORTCUTS.delete]: onDelete, escape: onClear });

	return (
		<div
			role="toolbar"
			aria-label={`${count} ${count === 1 ? noun[0] : noun[1]} selected`}
			className="thunderlist-selection-bar"
		>
			<Text weight="medium">{count} selected</Text>

			{children}

			{onDelete === undefined ? null : (
				<Button
					label="Delete"
					tooltip={`Delete (${TASK_SHORTCUTS.delete.toUpperCase()})`}
					variant="destructive"
					size="sm"
					icon={<Trash2 aria-hidden />}
					onClick={onDelete}
				/>
			)}

			<IconButton
				label="Clear selection"
				tooltip="Clear (Esc)"
				variant="ghost"
				size="sm"
				icon={<X aria-hidden />}
				onClick={onClear}
			/>
		</div>
	);
}
