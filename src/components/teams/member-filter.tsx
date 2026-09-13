import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Check, Users } from "lucide-react";
import { useSpace } from "#/lib/use-team";
import { memberName, type TeamMember } from "#/schemas/team";

/**
 * Whose work to show: everyone's, or one person's in the team.
 *
 * A menu rather than a switch like the sort, since a team has more than two
 * people in it. The choice lives on the screen, as the sort does. Outside a
 * team everything is yours, and it draws nothing.
 */
export function MemberFilter({
	value,
	onChange,
}: {
	/** An address, or `undefined` for everyone. */
	value: string | undefined;
	onChange: (email: string | undefined) => void;
}) {
	const space = useSpace();
	const team = space?.team ?? null;
	if (space === null || team === null) return null;

	const nameOf = (member: TeamMember) =>
		member.email === space.email
			? `${memberName(member)} (me)`
			: memberName(member);
	const chosen = team.members.find((member) => member.email === value);
	const tick = (isOn: boolean) =>
		isOn ? <Check aria-hidden size={16} /> : undefined;

	return (
		<DropdownMenu
			placement="below"
			alignment="end"
			button={{
				label:
					value === undefined
						? "Everyone"
						: chosen === undefined
							? value
							: nameOf(chosen),
				tooltip: "Show one person's",
				variant: value === undefined ? "ghost" : "secondary",
				size: "sm",
				icon: <Users aria-hidden />,
			}}
			items={[
				{
					label: "Everyone",
					endContent: tick(value === undefined),
					onClick: () => onChange(undefined),
				},
				{ type: "divider" as const },
				...team.members.map((member) => ({
					id: member.email,
					label: nameOf(member),
					endContent: tick(member.email === value),
					onClick: () => onChange(member.email),
				})),
			]}
		/>
	);
}
