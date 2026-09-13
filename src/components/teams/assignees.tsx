import { Avatar } from "@astryxdesign/core/Avatar";
import {
	AvatarGroup,
	AvatarGroupOverflow,
} from "@astryxdesign/core/AvatarGroup";
import { useTeam } from "#/lib/use-team";
import { memberName } from "#/schemas/team";

/** Past this many, the rest are a "+N". */
const SHOWN = 3;

/**
 * Who something is assigned to, as a row of faces.
 *
 * Someone who has since left the team is still drawn, by address: the task is
 * still theirs until somebody reassigns it.
 */
export function Assignees({ emails }: { emails: ReadonlyArray<string> }) {
	const team = useTeam();
	if (emails.length === 0) return null;

	const people = emails.map(
		(email) =>
			team?.members.find((member) => member.email === email) ?? {
				email,
				name: null,
				image: null,
			},
	);

	return (
		<AvatarGroup size="xsm">
			{people.slice(0, SHOWN).map((person) => (
				<Avatar
					key={person.email}
					name={memberName(person)}
					src={person.image ?? undefined}
				/>
			))}
			{people.length > SHOWN ? (
				<AvatarGroupOverflow count={people.length - SHOWN} />
			) : null}
		</AvatarGroup>
	);
}
