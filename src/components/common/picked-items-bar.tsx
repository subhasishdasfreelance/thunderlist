import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useMemo, useState } from "react";
import { PickBar } from "#/components/common/pick-bar";
import { AccessDialog } from "#/components/teams/access-dialog";
import { useApplyChange } from "#/lib/changes";
import { useHeld } from "#/lib/use-held";
import { useTeam } from "#/lib/use-team";
import { groupsQuery } from "#/queries/space";
import type { AccessEntry } from "#/schemas/access";
import type { PickableKind } from "#/schemas/change";
import { sameItem } from "#/schemas/group";

/** What each is called, one and several. */
const NOUNS: Record<PickableKind, readonly [string, string]> = {
	checklist: ["checklist", "checklists"],
	tracker: ["tracker", "trackers"],
	tag: ["tag", "tags"],
	plan: ["plan", "plans"],
	countdown: ["countdown", "countdowns"],
};

/** What deleting them takes with it, said before it is done. */
const DELETING: Record<PickableKind, string> = {
	checklist: "Each checklist and all of its tasks will be deleted.",
	tracker: "Each tracker and all of its readings will be deleted.",
	tag: "They will be taken off every task. The tasks themselves are not deleted.",
	plan: "They will be deleted.",
	countdown: "They will be deleted.",
};

/**
 * What can be done at once to the cards picked out on a screen; see
 * `usePickMode`. Each is one change for all of them.
 *
 * Deleting them, asked about first, for every kind. For checklists, trackers
 * and tags — what a group holds and an access list covers — putting them all
 * into a group, and in a team giving them all one access list. A button is
 * only there when it has something to do: no groups, no group menu.
 */
export function PickedItemsBar({
	of,
	items,
	onDone,
}: {
	of: PickableKind;
	/** The ones picked, with what the bar says about them. */
	items: ReadonlyArray<{
		id: string;
		access?: ReadonlyArray<AccessEntry> | null;
	}>;
	/** Stop picking: closed, or done with them. */
	onDone: () => void;
}) {
	const { apply } = useApplyChange();
	const team = useTeam();
	const groups = useQuery(groupsQuery()).data ?? [];
	const [isDeleting, setIsDeleting] = useState(false);
	const [isSharing, setIsSharing] = useState(false);
	// The count stays on the question while it closes; see `useHeld`.
	const shownCount = useHeld(isDeleting ? items.length : null);

	const noun = NOUNS[of];
	const ids = items.map((item) => item.id);
	// What a group holds and an access list covers; `null` for the rest.
	const groupable =
		of === "checklist" || of === "tracker" || of === "tag" ? of : null;

	// One list, where they all have the same; otherwise each its own.
	const shared = useMemo(() => {
		const first = JSON.stringify(items[0]?.access ?? null);
		const isSame = items.every(
			(item) => JSON.stringify(item.access ?? null) === first,
		);
		return {
			isSame,
			access: isSame ? (items[0]?.access ?? null) : null,
		};
	}, [items]);

	const named = (count: number) =>
		`${count} ${count === 1 ? noun[0] : noun[1]}`;

	return (
		<>
			<PickBar
				count={items.length}
				noun={noun}
				onDelete={items.length === 0 ? undefined : () => setIsDeleting(true)}
				onClear={onDone}
			>
				{groupable === null ||
				groups.length === 0 ||
				items.length === 0 ? null : (
					<DropdownMenu
						placement="above"
						alignment="start"
						button={{ label: "Add to group", variant: "secondary", size: "sm" }}
						items={groups.map((group) => ({
							id: group.groupId,
							label: group.name,
							onClick: () => {
								const adding = ids
									.map((id) => ({ kind: groupable, id }))
									.filter(
										(item) => !group.items.some((each) => sameItem(each, item)),
									);
								if (adding.length > 0) {
									apply({
										kind: "group.update",
										groupId: group.groupId,
										patch: { items: [...group.items, ...adding] },
									});
								}
								onDone();
							},
						}))}
					/>
				)}

				{groupable === null || team === null || items.length === 0 ? null : (
					<Button
						label="Share"
						variant="secondary"
						size="sm"
						icon={<Users aria-hidden />}
						onClick={() => setIsSharing(true)}
					/>
				)}
			</PickBar>

			<AlertDialog
				isOpen={isDeleting}
				onOpenChange={setIsDeleting}
				title={`Delete ${named(shownCount ?? 0)}?`}
				description={DELETING[of]}
				actionLabel="Delete"
				onAction={() => {
					if (ids.length > 0) apply({ kind: "items.delete", of, ids });
					setIsDeleting(false);
					onDone();
				}}
			/>

			{groupable === null || team === null ? null : (
				<AccessDialog
					isOpen={isSharing}
					onOpenChange={setIsSharing}
					title={`Who these ${noun[1]} are for`}
					subtitle={
						shared.isSame
							? named(items.length)
							: "Each is shared differently now. What is saved here goes on all of them."
					}
					noun={noun[0]}
					members={team.members}
					value={shared.access}
					onSubmit={(access) => {
						if (ids.length > 0) {
							apply({ kind: "items.share", of: groupable, ids, access });
						}
						setIsSharing(false);
						onDone();
					}}
				/>
			)}
		</>
	);
}
