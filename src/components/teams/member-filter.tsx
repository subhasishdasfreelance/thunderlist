import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { Check, Users, UserX } from "lucide-react";
import { useSpace } from "#/lib/use-team";
import { NO_ASSIGNEE } from "#/schemas/task";
import { memberName, type TeamMember } from "#/schemas/team";

/**
 * Whose work to show: everyone's, one person's in the team, or nobody's —
 * the work no one has been given yet.
 *
 * A menu rather than a switch like the sort, since a team has more than two
 * people in it. The choice lives on the screen, as the sort does. Outside a
 * team everything is yours, and it draws nothing.
 *
 * `hasUnassigned` is off where "nobody's" means nothing: what was logged on a
 * tracker was always logged by someone.
 */
export function MemberFilter({
	value,
	onChange,
	hasUnassigned = true,
}: {
	/** An address, `NO_ASSIGNEE`, or `undefined` for everyone. */
	value: string | undefined;
	onChange: (email: string | undefined) => void;
	hasUnassigned?: boolean;
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
		isOn ? <Icon icon={Check} size="sm" color="accent" /> : undefined;

	return (
		<DropdownMenu
			placement="below"
			alignment="end"
			button={{
				label:
					value === undefined
						? "Everyone"
						: value === NO_ASSIGNEE
							? "Unassigned"
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
					icon: Users,
					endContent: tick(value === undefined),
					onClick: () => onChange(undefined),
				},
				{ type: "divider" as const },
				{
					type: "section" as const,
					title: "One person's",
					items: team.members.map((member) => ({
						id: member.email,
						label: nameOf(member),
						endContent: tick(member.email === value),
						onClick: () => onChange(member.email),
					})),
				},
				...(hasUnassigned
					? [
							{ type: "divider" as const },
							{
								label: "Unassigned",
								icon: UserX,
								endContent: tick(value === NO_ASSIGNEE),
								onClick: () => onChange(NO_ASSIGNEE),
							},
						]
					: []),
			]}
		/>
	);
}
