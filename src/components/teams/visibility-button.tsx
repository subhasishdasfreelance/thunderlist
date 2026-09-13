import { Avatar } from "@astryxdesign/core/Avatar";
import {
	AvatarGroup,
	AvatarGroupOverflow,
} from "@astryxdesign/core/AvatarGroup";
import { Eye } from "lucide-react";
import { useState } from "react";
import { usePermissions, useSpace } from "#/lib/use-team";
import { memberName, ROLE_LABELS, roleCan } from "#/schemas/team";
import { PeoplePickerDialog } from "./people-picker-dialog";

/** Faces drawn on the button; the rest are a "+N". */
const SHOWN = 4;

/**
 * Who in the team can see a checklist, a tag or a tracker, at the top of its
 * page — a row of faces beside the way back, so a list only some of the team
 * can see is never taken for one everybody can.
 *
 * Pressing it opens the same picker a task is assigned with: search the team,
 * pick people, or let everyone in. The admin and viewers see everything
 * whatever this says, so they are always shown and cannot be taken off. Only
 * the admin and project managers can change it; anyone else can open it to
 * see who is in.
 * Outside a team there is nobody to keep anything from, and it draws nothing.
 */
export function VisibilityButton({
	noun,
	visibleTo,
	onChange,
}: {
	/** What this is — "checklist", "tag", "tracker" — for its words. */
	noun: string;
	/** The addresses allowed, or `null`/absent for everyone. */
	visibleTo: ReadonlyArray<string> | null | undefined;
	onChange: (visibleTo: Array<string> | null) => void;
}) {
	const space = useSpace();
	const { canManageContent } = usePermissions();
	const [isOpen, setIsOpen] = useState(false);

	const team = space?.team ?? null;
	if (space === null || team === null) return null;

	const isEveryone = visibleTo == null;
	const viewers = team.members.filter(
		(member) =>
			isEveryone ||
			roleCan(member.role, "seeEverything") ||
			visibleTo.includes(member.email),
	);
	const summary = isEveryone
		? "Everyone"
		: viewers.length === 1 && viewers[0].email === space.email
			? "Only you"
			: `${viewers.length} ${viewers.length === 1 ? "person" : "people"}`;

	return (
		<>
			<button
				type="button"
				className="thunderlist-people-button"
				aria-label={`Who can see this ${noun}: ${summary}`}
				title={`Who can see this ${noun}`}
				onClick={() => setIsOpen(true)}
			>
				{isEveryone ? <Eye aria-hidden size={16} /> : null}
				<AvatarGroup size="xsm">
					{viewers.slice(0, SHOWN).map((member) => (
						<Avatar
							key={member.email}
							name={memberName(member)}
							src={member.image ?? undefined}
							tooltip={false}
						/>
					))}
					{viewers.length > SHOWN ? (
						<AvatarGroupOverflow count={viewers.length - SHOWN} />
					) : null}
				</AvatarGroup>
				<span>{summary}</span>
			</button>

			<PeoplePickerDialog
				isOpen={isOpen}
				onOpenChange={setIsOpen}
				title={`Who can see this ${noun}`}
				subtitle={
					isEveryone
						? `Everyone in ${team.name}.`
						: `${viewers.length} of ${team.members.length} people in ${team.name}.`
				}
				members={team.members}
				value={visibleTo ?? null}
				everyoneLabel={`Everyone in ${team.name}`}
				lockedNote={(member) =>
					roleCan(member.role, "seeEverything")
						? `${ROLE_LABELS[member.role]}, sees everything`
						: null
				}
				readOnlyNote={
					canManageContent
						? undefined
						: "Only the admin and project managers can change who sees it."
				}
				onSubmit={(chosen) => {
					onChange(chosen);
					setIsOpen(false);
				}}
			/>
		</>
	);
}
