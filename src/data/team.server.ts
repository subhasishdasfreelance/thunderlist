/**
 * Teams, and working in one. Server only.
 *
 * A team is a space of its own: its checklists, tags, trackers and tasks are
 * stored exactly like anyone's, owned by the team's id instead of a person's.
 * So everything the app does in your own space it does in a team's, by the same
 * code, and nothing of one can be read from the other.
 *
 * People are members by the address their Google account signs in with, so the
 * admin can add someone before they have ever opened the app. Their name and
 * picture are read from the account once there is one.
 *
 * Each member has a role, and the role decides what they may change; see
 * `TeamRole`. There is one admin — whoever made the team — and the job is
 * handed over rather than shared, so there is always exactly one person who
 * can add people, change what they are, and delete the team.
 */

import { MongoServerError } from "mongodb";
import { AppError } from "#/lib/errors";
import { createId, ID_PREFIX } from "#/lib/ids";
import { type Collections, collections } from "#/lib/mongo/client.server";
import {
	type GrantedRole,
	roleCan,
	roleRank,
	type SpaceView,
	storedRole,
	type TeamDetail,
	type TeamMember,
	type TeamRole,
	type TeamSummary,
} from "#/schemas/team";
import { type Hidden, NOTHING_HIDDEN, readHidden } from "./visibility.server";

/** Where one request is working, and what it may see and do there. */
export type Scope = {
	/** Whose rows it reads and writes: the person's own id, or the team's. */
	ownerId: string;
	/** Who is asking, lower-cased. */
	email: string;
	/** The team, when it is one: what they are in it, and who is in it. */
	team: { teamId: string; role: TeamRole; emails: Array<string> } | null;
	/** What in the team is kept from this person; see `Hidden`. */
	hidden: Hidden;
};

type Person = { userId: string; email: string };

/**
 * Where a person is working, given the team their browser asked for.
 *
 * Someone asking for a team they are not in — taken out of it, or it was
 * deleted — works in their own space instead. That is not an error: it is
 * where they would be had they never been in it.
 */
export async function resolveScope(
	person: Person,
	teamId: string | undefined,
): Promise<Scope> {
	const email = person.email.toLowerCase();
	const own: Scope = {
		ownerId: person.userId,
		email,
		team: null,
		hidden: NOTHING_HIDDEN,
	};
	if (teamId === undefined || teamId === "") return own;

	const current = await collections();
	const members = await current.members
		.find({ teamId }, { projection: { _id: 0, email: 1, role: 1 } })
		.toArray();
	const me = members.find((member) => member.email === email);
	if (!me) return own;

	const role = storedRole(me.role);

	return {
		ownerId: teamId,
		email,
		team: { teamId, role, emails: members.map((member) => member.email) },
		// The admin and viewers see everything, whoever it is kept to.
		hidden: roleCan(role, "seeEverything")
			? NOTHING_HIDDEN
			: await readHidden(current, teamId, email),
	};
}

/** The space a person is in, with every team they could be in instead. */
export async function getSpace(
	person: Person,
	teamId: string | undefined,
): Promise<SpaceView> {
	const scope = await resolveScope(person, teamId);
	const teams = await listTeams(scope.email);
	const active = teams.find((team) => team.teamId === scope.team?.teamId);

	return {
		email: scope.email,
		teams,
		team:
			active === undefined
				? null
				: { ...active, members: await listMembers(active.teamId) },
	};
}

/** Every team a person is in, each with its people, for the Settings screen. */
export async function listTeamDetails(
	email: string,
): Promise<Array<TeamDetail>> {
	const teams = await listTeams(email.toLowerCase());

	return Promise.all(
		teams.map(async (team) => ({
			...team,
			members: await listMembers(team.teamId),
		})),
	);
}

async function listTeams(email: string): Promise<Array<TeamSummary>> {
	const current = await collections();
	const memberships = await current.members
		.find({ email }, { projection: { _id: 0, teamId: 1, role: 1 } })
		.toArray();
	if (memberships.length === 0) return [];

	const teams = await current.teams
		.find(
			{ teamId: { $in: memberships.map((membership) => membership.teamId) } },
			{ projection: { _id: 0, teamId: 1, name: 1 } },
		)
		.toArray();

	return teams
		.map((team) => ({
			teamId: team.teamId,
			name: team.name,
			role: storedRole(
				memberships.find((membership) => membership.teamId === team.teamId)
					?.role ?? "",
			),
		}))
		.sort((a, b) =>
			a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
		);
}

/** Everyone in a team, the admin first and down the roles, then by name. */
async function listMembers(teamId: string): Promise<Array<TeamMember>> {
	const current = await collections();
	const members = await current.members
		.find({ teamId }, { projection: { _id: 0, email: 1, role: 1 } })
		.toArray();

	const accounts = await current.users
		.find(
			{ email: { $in: members.map((member) => member.email) } },
			{ projection: { _id: 0, email: 1, name: 1, image: 1 } },
		)
		.toArray();

	return members
		.map((member) => {
			const account = accounts.find(
				(each) => each.email.toLowerCase() === member.email,
			);
			return {
				email: member.email,
				name: account?.name ?? null,
				image: account?.image ?? null,
				role: storedRole(member.role),
			};
		})
		.sort(
			(a, b) =>
				roleRank(a.role) - roleRank(b.role) ||
				(a.name ?? a.email).localeCompare(b.name ?? b.email, undefined, {
					sensitivity: "base",
				}),
		);
}

/* -------------------------------------------------------------------------- */
/* Changing a team                                                            */
/* -------------------------------------------------------------------------- */

/** Two requests raced to add the same person; the other won. */
function isDuplicateKey(error: unknown): boolean {
	return error instanceof MongoServerError && error.code === 11000;
}

/** Make a team, with its maker as its admin. */
export async function createTeam(email: string, name: string): Promise<string> {
	const current = await collections();
	const teamId = createId(ID_PREFIX.team);
	const now = new Date().toISOString();

	await current.teams.insertOne({ teamId, name, createdAt: now });
	await current.members.insertOne({
		teamId,
		email,
		role: "admin",
		addedAt: now,
	});

	return teamId;
}

async function requireAdmin(
	current: Collections,
	teamId: string,
	email: string,
): Promise<void> {
	const me = await current.members.findOne(
		{ teamId, email },
		{ projection: { _id: 0, role: 1 } },
	);

	if (!me) throw new AppError("not_found", "That team no longer exists.");
	if (storedRole(me.role) !== "admin") {
		throw new AppError("invalid_data", "Only the team's admin can do that.");
	}
}

/** A team always keeps an admin, or nobody could add anyone to it again. */
async function assertAnotherAdmin(
	current: Collections,
	teamId: string,
	email: string,
): Promise<void> {
	const others = await current.members.countDocuments({
		teamId,
		role: "admin",
		email: { $ne: email },
	});

	if (others === 0) {
		throw new AppError(
			"invalid_data",
			"A team needs an admin. Make someone else the admin first, or delete the team.",
		);
	}
}

/** Add someone by address. Adding someone already in it changes nothing. */
export async function addMember(
	teamId: string,
	actor: string,
	email: string,
	role: GrantedRole,
): Promise<void> {
	const current = await collections();
	await requireAdmin(current, teamId, actor);

	try {
		await current.members.updateOne(
			{ teamId, email },
			{
				$setOnInsert: {
					teamId,
					email,
					role,
					addedAt: new Date().toISOString(),
				},
			},
			{ upsert: true },
		);
	} catch (error) {
		if (!isDuplicateKey(error)) throw error;
	}
}

/**
 * Change what someone is in a team — the admin's to do.
 *
 * Making someone the admin hands the team over: they become the admin, and the
 * admin who did it becomes a project manager. The new admin is written first,
 * so a failure between the two leaves two admins rather than none.
 */
export async function setMemberRole(
	teamId: string,
	actor: string,
	email: string,
	role: TeamRole,
): Promise<void> {
	const current = await collections();
	await requireAdmin(current, teamId, actor);

	if (email === actor) {
		throw new AppError(
			"invalid_data",
			"You can't change your own role. Make someone else the admin instead.",
		);
	}

	const target = await current.members.findOne(
		{ teamId, email },
		{ projection: { _id: 0, role: 1 } },
	);
	if (!target) {
		throw new AppError("not_found", "They are no longer in this team.");
	}

	await current.members.updateOne({ teamId, email }, { $set: { role } });

	if (role === "admin") {
		await current.members.updateOne(
			{ teamId, email: actor },
			{ $set: { role: "manager" } },
		);
	}
}

/**
 * Take someone out of a team — the admin's to do — or leave it, which anyone
 * but the admin can. What is assigned to them stays assigned until someone
 * changes it.
 */
export async function removeMember(
	teamId: string,
	actor: string,
	email: string,
): Promise<void> {
	const current = await collections();
	if (actor !== email) await requireAdmin(current, teamId, actor);

	const target = await current.members.findOne(
		{ teamId, email },
		{ projection: { _id: 0, role: 1 } },
	);
	// Already gone is the outcome this asked for, not a failure.
	if (!target) return;

	if (storedRole(target.role) === "admin") {
		await assertAnotherAdmin(current, teamId, email);
	}
	await current.members.deleteOne({ teamId, email });
}

/**
 * Delete a team and everything in it, for everyone. What it holds goes first,
 * as a checklist's tasks do: a team left holding its data can be deleted again,
 * whereas data whose team has gone could never be reached.
 */
export async function deleteTeam(teamId: string, actor: string): Promise<void> {
	const current = await collections();
	await requireAdmin(current, teamId, actor);

	const owned = { userId: teamId };
	await Promise.all([
		current.tasks.deleteMany(owned),
		current.entries.deleteMany(owned),
	]);
	await Promise.all([
		current.checklists.deleteMany(owned),
		current.trackers.deleteMany(owned),
		current.tags.deleteMany(owned),
		current.settings.deleteMany(owned),
	]);
	await current.members.deleteMany({ teamId });
	await current.teams.deleteOne({ teamId });
}
