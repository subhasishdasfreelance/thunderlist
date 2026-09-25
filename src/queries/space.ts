import { queryOptions } from "@tanstack/react-query";
import {
	listArrangementsFn,
	listTaskTypesFn,
} from "#/functions/settings.functions";
import { getSpaceFn, listTeamsFn } from "#/functions/team.functions";
import { queryKeys } from "./keys";

/**
 * Where the app is working — your own space or a team's — and who is in the
 * team, for assigning and filtering.
 *
 * It changes rarely, and whatever changes it reads it again, so it is left a
 * minute before being re-checked — and it is, every minute the app is open and
 * on coming back to it, which is how being taken out of a team from somewhere
 * else is noticed; see `useSpaceWatch`.
 */
export const spaceQuery = () =>
	queryOptions({
		queryKey: queryKeys.space,
		queryFn: () => getSpaceFn(),
		staleTime: 60_000,
		refetchInterval: 60_000,
	});

/** Every team this person is in, with its people, for the Settings screen. */
export const teamsQuery = () =>
	queryOptions({
		queryKey: queryKeys.teams,
		queryFn: () => listTeamsFn(),
	});

/**
 * The task types of the space being worked in. Like the space, it changes
 * rarely and is read again by whatever changes it.
 */
export const taskTypesQuery = () =>
	queryOptions({
		queryKey: queryKeys.taskTypes,
		queryFn: () => listTaskTypesFn(),
		staleTime: 60_000,
	});

/**
 * How the space lays out its checklists, trackers and tags: the order picked
 * by hand, and the groups. Rarely changed, and read again by whatever does.
 */
export const arrangementsQuery = () =>
	queryOptions({
		queryKey: queryKeys.arrangements,
		queryFn: () => listArrangementsFn(),
		staleTime: 60_000,
	});
