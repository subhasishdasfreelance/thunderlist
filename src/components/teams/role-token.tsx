import { Token } from "@astryxdesign/core/Token";
import { ROLE_LABELS, type TeamRole } from "#/schemas/team";

/**
 * A colour for each role: the one person who runs a team stands out most, and
 * someone who only looks, least.
 */
const ROLE_COLORS: Record<TeamRole, "purple" | "blue" | "green" | "gray"> = {
	admin: "purple",
	manager: "blue",
	collaborator: "green",
	viewer: "gray",
};

/** What someone is in a team, drawn the same wherever a role is shown. */
export function RoleToken({ role }: { role: TeamRole }) {
	return (
		<Token size="sm" color={ROLE_COLORS[role]} label={ROLE_LABELS[role]} />
	);
}
