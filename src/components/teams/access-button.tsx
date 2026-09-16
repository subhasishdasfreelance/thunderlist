import { Avatar } from "@astryxdesign/core/Avatar";
import {
	AvatarGroup,
	AvatarGroupOverflow,
} from "@astryxdesign/core/AvatarGroup";
import { Button } from "@astryxdesign/core/Button";
import { Eye } from "lucide-react";
import { useState } from "react";
import { useSpace } from "#/lib/use-team";
import { type AccessEntry, levelFor } from "#/schemas/access";
import { memberName } from "#/schemas/team";
import { AccessDialog } from "./access-dialog";

/** Faces drawn on the button; the rest are a "+N", as on a task's row. */
const SHOWN = 3;

/**
 * Who in the team this checklist, tag or tracker is for, at the top of its
 * page — a row of faces beside the way back, so something only a few of the
 * team can reach is never taken for everybody's. The same kind of button as
 * the way back, so the two read as a pair.
 *
 * Pressing it opens the list: search the team, put someone on it, and say how
 * far in they may go; see `AccessDialog`. Only whoever runs it — the admin, or
 * someone given Full — can change it; anyone else can open it to see who is
 * on it.
 *
 * Outside a team there is nobody to keep anything from, and it draws nothing.
 */
export function AccessButton({
	noun,
	access,
	canChange,
	onChange,
}: {
	/** What this is — "checklist", "tag", "tracker" — for its words. */
	noun: string;
	/** Who may do what, or `null`/absent for the whole team. */
	access: ReadonlyArray<AccessEntry> | null | undefined;
	/** Whether this person may change it; see `AccessDialog`. */
	canChange: boolean;
	onChange: (access: Array<AccessEntry> | null) => void;
}) {
	const space = useSpace();
	const [isOpen, setIsOpen] = useState(false);

	const team = space?.team ?? null;
	if (space === null || team === null) return null;

	const isEveryone = access == null;
	// Whoever the list reaches: those named, and the people whose role puts
	// them on every list anyway.
	const on = team.members.filter(
		(member) => levelFor(member.role, member.email, access) !== null,
	);
	const summary = isEveryone
		? "Everyone"
		: on.length === 1 && on[0].email === space.email
			? "Only you"
			: `${on.length} ${on.length === 1 ? "person" : "people"}`;

	return (
		<>
			<Button
				label={`Who this ${noun} is for: ${summary}`}
				tooltip={`Who this ${noun} is for`}
				variant="secondary"
				size="sm"
				icon={isEveryone ? <Eye aria-hidden /> : undefined}
				onClick={() => setIsOpen(true)}
			>
				<span className="inline-flex items-center gap-2">
					<AvatarGroup size="xsm">
						{on.slice(0, SHOWN).map((member) => (
							<Avatar
								key={member.email}
								name={memberName(member)}
								src={member.image ?? undefined}
								tooltip={false}
							/>
						))}
						{on.length > SHOWN ? (
							<AvatarGroupOverflow count={on.length - SHOWN} />
						) : null}
					</AvatarGroup>
					{summary}
				</span>
			</Button>

			<AccessDialog
				isOpen={isOpen}
				onOpenChange={setIsOpen}
				title={`Who this ${noun} is for`}
				subtitle={
					isEveryone
						? `Everyone in ${team.name}.`
						: `${on.length} of ${team.members.length} people in ${team.name}.`
				}
				noun={noun}
				members={team.members}
				value={access ?? null}
				isReadOnly={!canChange}
				onSubmit={(next) => {
					onChange(next);
					setIsOpen(false);
				}}
			/>
		</>
	);
}
