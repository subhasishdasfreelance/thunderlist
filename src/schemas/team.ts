import * as v from "valibot";
import { emailSchema, idSchema } from "./common";

/**
 * What someone is in a team, most powerful first.
 *
 * - **Admin** — whoever made the team, and only ever one person. Everything,
 *   including who is in the team, what each of them is, and deleting it. Sees
 *   everything, whoever it is kept to.
 * - **Project manager** — runs the work: adds and deletes tasks and moves
 *   them between checklists; makes, changes and deletes checklists, trackers,
 *   tags and task types, and decides who can see each.
 * - **Collaborator** — works the tasks they can see: ticks them, moves them
 *   along their stages, edits, flags and takes them on, and records tracker
 *   progress. Adds nothing and deletes nothing.
 * - **Viewer** — sees everything, whoever it is kept to, and changes nothing.
 *
 * Project managers and collaborators see only what is shared with them; see
 * `visibleToSchema`.
 */
export const TEAM_ROLES = [
	"admin",
	"manager",
	"collaborator",
	"viewer",
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

/**
 * The roles an admin can give someone. Admin is not among them: there is one,
 * and it is handed over rather than given out; see `setMemberRole`.
 */
export const GRANTED_ROLES = ["manager", "collaborator", "viewer"] as const;

export type GrantedRole = (typeof GRANTED_ROLES)[number];

export const ROLE_LABELS: Record<TeamRole, string> = {
	admin: "Admin",
	manager: "Project manager",
	collaborator: "Collaborator",
	viewer: "Viewer",
};

/** One line each, for wherever a role is picked or explained. */
export const ROLE_SUMMARIES: Record<TeamRole, string> = {
	admin: "Everything, including people and deleting the team.",
	manager: "Adds and deletes tasks, lists, trackers, tags and types.",
	collaborator: "Ticks, moves and updates tasks. Adds and deletes nothing.",
	viewer: "Sees everything. Changes nothing.",
};

/**
 * What a role can do.
 *
 * - `manageTeam`: add and remove people, change what they are, delete the team.
 * - `manageContent`: add and delete anything — tasks included — and move tasks
 *   between checklists; make, change and delete checklists, trackers, tags and
 *   task types, and choose who can see each of them.
 * - `updateTasks`: change a task that exists — tick it, move it along its
 *   stages, edit it, flag it, assign it — and record a tracker's progress.
 * - `seeEverything`: see every checklist, tag and tracker, whoever it is kept
 *   to.
 */
export type Capability =
	| "manageTeam"
	| "manageContent"
	| "updateTasks"
	| "seeEverything";

const CAPABILITIES: Record<TeamRole, ReadonlyArray<Capability>> = {
	admin: ["manageTeam", "manageContent", "updateTasks", "seeEverything"],
	manager: ["manageContent", "updateTasks"],
	collaborator: ["updateTasks"],
	viewer: ["seeEverything"],
};

export function roleCan(role: TeamRole, capability: Capability): boolean {
	return CAPABILITIES[role].includes(capability);
}

/**
 * A role as stored. Before roles were split there was only "member", who
 * could do everything but run the team — which is a project manager now.
 */
export function storedRole(role: string): TeamRole {
	return (TEAM_ROLES as ReadonlyArray<string>).includes(role)
		? (role as TeamRole)
		: "manager";
}

/** Admin first, then down the list; see `TEAM_ROLES`. */
export function roleRank(role: TeamRole): number {
	return TEAM_ROLES.indexOf(role);
}

const teamNameSchema = v.pipe(
	v.string(),
	v.trim(),
	v.minLength(1, "Team name is required"),
	v.maxLength(60, "Team name must be 60 characters or fewer"),
);

/** A team the signed-in person is in, and what they are in it. */
export type TeamSummary = { teamId: string; name: string; role: TeamRole };

/**
 * Someone in a team, known by the address their Google account signs in with.
 * The name and picture are the account's, and `null` until they first sign in.
 */
export type TeamMember = {
	email: string;
	name: string | null;
	image: string | null;
	role: TeamRole;
};

/** A member as the screen names them: by name, or by address until they have one. */
export function memberName(member: Pick<TeamMember, "name" | "email">): string {
	return member.name ?? member.email;
}

/** A team with its people, as the Settings screen lists every one. */
export type TeamDetail = TeamSummary & { members: Array<TeamMember> };

/** Where the app is working, as the browser is told it. */
export type SpaceView = {
	/** Who is asking, lower-cased, so a screen can pick them out of a team. */
	email: string;
	/** Every team they are in, to move between. */
	teams: Array<TeamSummary>;
	/** The team being worked in, with its people; `null` for their own space. */
	team: TeamDetail | null;
};

export const createTeamInputSchema = v.object({ name: teamNameSchema });

/** A team to work in from now on, or `null` for your own space. */
export const selectSpaceInputSchema = v.object({
	teamId: v.nullable(idSchema),
});

export const teamIdInputSchema = v.object({ teamId: idSchema });

export const memberInputSchema = v.object({
	teamId: idSchema,
	email: emailSchema,
});

/** Someone to add, and what they are to be; a collaborator unless said. */
export const addMemberInputSchema = v.object({
	...memberInputSchema.entries,
	role: v.optional(v.picklist(GRANTED_ROLES), "collaborator"),
});

/** A new role for someone. `admin` hands the team over to them. */
export const memberRoleInputSchema = v.object({
	teamId: idSchema,
	email: emailSchema,
	role: v.picklist(TEAM_ROLES),
});
