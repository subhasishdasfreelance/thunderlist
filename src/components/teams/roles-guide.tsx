import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Check, Minus } from "lucide-react";
import { ROLE_LABELS, TEAM_ROLES, type TeamRole } from "#/schemas/team";

/**
 * What each role in a team may do, as a table — the same rules the server
 * holds every change to; see `roleCan`.
 */
const ROWS: Array<{ what: string; roles: ReadonlyArray<TeamRole> }> = [
	{
		what: "See everything, whoever it is kept to",
		roles: ["admin", "viewer"],
	},
	{
		what: "See what is shared with them",
		roles: ["admin", "manager", "collaborator", "viewer"],
	},
	{
		what: "Tick tasks, move them through stages, edit, flag and take them on; record tracker progress",
		roles: ["admin", "manager", "collaborator"],
	},
	{
		what: "Add and delete tasks, and move them between checklists",
		roles: ["admin", "manager"],
	},
	{
		what: "Make, change and delete checklists, trackers, tags and task types",
		roles: ["admin", "manager"],
	},
	{
		what: "Choose who can see a checklist, a tag or a tracker",
		roles: ["admin", "manager"],
	},
	{
		what: "Add and remove people, and change their roles",
		roles: ["admin"],
	},
	{ what: "Delete the team", roles: ["admin"] },
];

/** The rules of a team's roles, opened from inside the team's popup. */
export function RolesGuide() {
	return (
		<VStack gap={3}>
			<Text type="supporting">
				Whoever makes a team is its admin, and there is only ever one: making
				someone else the admin hands the team over. The admin gives everyone
				else a role when adding them, and can change it at any time.
			</Text>

			{/* Wider than a phone, so it scrolls rather than the page. */}
			<div className="overflow-x-auto">
				<table className="thunderlist-roles">
					<thead>
						<tr>
							<th scope="col">
								<span className="sr-only">What they can do</span>
							</th>
							{TEAM_ROLES.map((role) => (
								<th key={role} scope="col">
									{ROLE_LABELS[role]}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{ROWS.map((row) => (
							<tr key={row.what}>
								<th scope="row">{row.what}</th>
								{TEAM_ROLES.map((role) =>
									row.roles.includes(role) ? (
										<td key={role} data-can="true">
											<Check aria-label="Yes" size={16} />
										</td>
									) : (
										<td key={role}>
											<Minus aria-label="No" size={16} />
										</td>
									),
								)}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</VStack>
	);
}
