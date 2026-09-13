import { createServerFn } from "@tanstack/react-start";
import {
	deleteCookie,
	getCookie,
	setCookie,
} from "@tanstack/react-start/server";
import {
	addMember,
	createTeam,
	deleteTeam,
	getSpace,
	listTeamDetails,
	removeMember,
	resolveScope,
	setMemberRole,
} from "#/data/team.server";
import { requireUser } from "#/lib/auth.server";
import { AppError } from "#/lib/errors";
import {
	addMemberInputSchema,
	createTeamInputSchema,
	memberInputSchema,
	memberRoleInputSchema,
	selectSpaceInputSchema,
	teamIdInputSchema,
} from "#/schemas/team";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";
import { SPACE_COOKIE } from "./scope";

/**
 * A year long, and read only by the server. It names a team and that is all:
 * whether this person may work in it is checked on every request.
 */
const SPACE_COOKIE_OPTIONS = {
	path: "/",
	httpOnly: true,
	sameSite: "lax",
	maxAge: 60 * 60 * 24 * 365,
} as const;

function leaveTeamCookie(teamId: string): void {
	if (getCookie(SPACE_COOKIE) === teamId) {
		deleteCookie(SPACE_COOKIE, { path: "/" });
	}
}

/** Teams know their people by address, lower-cased; see `emailSchema`. */
async function requireEmail(): Promise<string> {
	return (await requireUser()).email.toLowerCase();
}

/** Where this browser is working, and the teams it could work in instead. */
export const getSpaceFn = createServerFn().handler(() =>
	guard("getSpace", async () =>
		getSpace(await requireUser(), getCookie(SPACE_COOKIE)),
	),
);

/** Every team this person is in, each with its people; see Settings. */
export const listTeamsFn = createServerFn().handler(() =>
	guard("listTeams", async () => listTeamDetails(await requireEmail())),
);

/** Work in a team from now on — or, with `null`, in your own space. */
export const selectSpaceFn = createServerFn({ method: "POST" })
	.validator(validator(selectSpaceInputSchema))
	.handler(({ data }) =>
		guard("selectSpace", async () => {
			const user = await requireUser();

			if (data.teamId === null) {
				deleteCookie(SPACE_COOKIE, { path: "/" });
				return;
			}

			const scope = await resolveScope(user, data.teamId);
			if (scope.team === null) {
				throw new AppError("not_found", "You are not in that team.");
			}

			setCookie(SPACE_COOKIE, data.teamId, SPACE_COOKIE_OPTIONS);
		}),
	);

/** Make a team, with its maker as its admin, and start working in it. */
export const createTeamFn = createServerFn({ method: "POST" })
	.validator(validator(createTeamInputSchema))
	.handler(({ data }) =>
		guard("createTeam", async () => {
			const teamId = await createTeam(await requireEmail(), data.name);
			setCookie(SPACE_COOKIE, teamId, SPACE_COOKIE_OPTIONS);
			return teamId;
		}),
	);

export const addMemberFn = createServerFn({ method: "POST" })
	.validator(validator(addMemberInputSchema))
	.handler(({ data }) =>
		guard("addMember", async () =>
			addMember(data.teamId, await requireEmail(), data.email, data.role),
		),
	);

export const setMemberRoleFn = createServerFn({ method: "POST" })
	.validator(validator(memberRoleInputSchema))
	.handler(({ data }) =>
		guard("setMemberRole", async () =>
			setMemberRole(data.teamId, await requireEmail(), data.email, data.role),
		),
	);

/** Take someone out of a team — or, naming yourself, leave it. */
export const removeMemberFn = createServerFn({ method: "POST" })
	.validator(validator(memberInputSchema))
	.handler(({ data }) =>
		guard("removeMember", async () => {
			const actor = await requireEmail();
			await removeMember(data.teamId, actor, data.email);
			if (data.email === actor) leaveTeamCookie(data.teamId);
		}),
	);

/** Delete a team and everything in it, for everyone. Its admins only. */
export const deleteTeamFn = createServerFn({ method: "POST" })
	.validator(validator(teamIdInputSchema))
	.handler(({ data }) =>
		guard("deleteTeam", async () => {
			await deleteTeam(data.teamId, await requireEmail());
			leaveTeamCookie(data.teamId);
		}),
	);
