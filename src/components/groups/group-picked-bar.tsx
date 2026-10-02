import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { FolderMinus } from "lucide-react";
import { useState } from "react";
import {
	EditItemsButton,
	editableChecklist,
	editableTag,
	editableTracker,
} from "#/components/common/items-edit-dialog";
import { PickBar } from "#/components/common/pick-bar";
import { DELETING } from "#/components/common/picked-items-bar";
import { useApplyChange } from "#/lib/changes";
import { useHeld } from "#/lib/use-held";
import type { Group } from "#/schemas/group";
import { GROUP_ITEM_KINDS, sameItem } from "#/schemas/group";
import type { GroupContents } from "./group-contents";

/**
 * What can be done at once to the cards picked out on a group's page, of any
 * kind: editing what they share, taking them out of the group, or deleting
 * them, asked about first; see `usePickMode`.
 *
 * Deleting is one change for each kind picked, since each kind is deleted in
 * its own way; see `items.delete`.
 */
export function GroupPickedBar({
	group,
	contents,
	picked,
	onDone,
}: {
	group: Group;
	contents: GroupContents;
	picked: ReadonlySet<string>;
	onDone: () => void;
}) {
	const { apply } = useApplyChange();
	const [isDeleting, setIsDeleting] = useState(false);

	const items = [
		...contents.checklists
			.filter((each) => picked.has(each.checklistId))
			.map(editableChecklist),
		...contents.trackers
			.filter((each) => picked.has(each.trackerId))
			.map(editableTracker),
		...contents.tags.filter((each) => picked.has(each.tagId)).map(editableTag),
	];
	const kinds = GROUP_ITEM_KINDS.filter((kind) =>
		items.some((item) => item.kind === kind),
	);
	// The count stays on the question while it closes; see `useHeld`.
	const shownCount = useHeld(isDeleting ? items.length : null);

	return (
		<>
			<PickBar
				count={items.length}
				noun={["item", "items"]}
				onDelete={items.length === 0 ? undefined : () => setIsDeleting(true)}
				onClear={onDone}
			>
				{items.length === 0 ? null : (
					<>
						<EditItemsButton items={items} onDone={onDone} />
						<Button
							label="Remove from group"
							variant="secondary"
							size="sm"
							icon={<FolderMinus aria-hidden />}
							onClick={() => {
								apply({
									kind: "group.update",
									groupId: group.groupId,
									patch: {
										items: group.items.filter(
											(each) => !items.some((item) => sameItem(each, item)),
										),
									},
								});
								onDone();
							}}
						/>
					</>
				)}
			</PickBar>

			<AlertDialog
				isOpen={isDeleting}
				onOpenChange={setIsDeleting}
				title={`Delete ${shownCount ?? 0} ${shownCount === 1 ? "item" : "items"}?`}
				description={kinds.map((kind) => DELETING[kind]).join(" ")}
				actionLabel="Delete"
				onAction={() => {
					for (const kind of kinds) {
						apply({
							kind: "items.delete",
							of: kind,
							ids: items
								.filter((item) => item.kind === kind)
								.map((item) => item.id),
						});
					}
					setIsDeleting(false);
					onDone();
				}}
			/>
		</>
	);
}
