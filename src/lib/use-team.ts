import { useQuery } from "@tanstack/react-query";
import { spaceQuery } from "#/queries/space";
import { roleCan, type SpaceView, type TeamRole } from "#/schemas/team";

/** Where the app is working, once that has been read; see `SpaceView`. */
export function useSpace(): SpaceView | null {
	return useQuery(spaceQuery()).data ?? null;
}

/**
 * The team being worked in, with its people — or `null` in your own space,
 * where there is nobody to assign anything to or keep anything from, and the
 * controls for those stay out of the way.
 */
export function useTeam(): SpaceView["team"] {
	return useSpace()?.team ?? null;
}

/**
 * What the person looking may change where they are working; see `TeamRole`.
 *
 * In your own space, everything. The server refuses anything a role may not do
 * whatever the screen shows, so this only keeps the controls for it out of the
 * way — which is also why, while the space is still loading, nothing is held
 * back.
 */
export type Permissions = {
	/** In a team, what they are in it; `null` in their own space. */
	role: TeamRole | null;
	/**
	 * Add and delete anything, tasks included, and move tasks between
	 * checklists; make, change and delete checklists, trackers, tags and task
	 * types, and choose who sees them.
	 */
	canManageContent: boolean;
	/** Tick, move along, edit, flag and assign tasks; record progress. */
	canUpdateTasks: boolean;
};

export function usePermissions(): Permissions {
	const team = useTeam();
	if (team === null) {
		return { role: null, canManageContent: true, canUpdateTasks: true };
	}

	return {
		role: team.role,
		canManageContent: roleCan(team.role, "manageContent"),
		canUpdateTasks: roleCan(team.role, "updateTasks"),
	};
}
