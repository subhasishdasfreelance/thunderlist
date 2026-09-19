/**
 * Who may do what with what, in a team. Server only.
 *
 * A checklist, a tag or a tracker carries an access list: who may see it, and
 * what each of them may do with it — read it, work its tasks, or run it
 * outright; see `accessSchema`. A role still caps that, so a list can never
 * hand out more than someone may do in the team at all.
 *
 * What something holds goes with it: a task in a checklist is seen by whoever
 * can see that checklist, and a task in the Inbox — which belongs to no
 * checklist of its own — by whoever can see one of its tags, or by everyone if
 * it has none. Today, the Backlog and the Inbox are everyone's.
 *
 * To anyone the list leaves out, it does not exist: it is left out of every
 * list and search, and naming it by id is answered as for something deleted.
 * The team's admin and its viewers are on every list by right, and in your own
 * space there is nobody to keep anything from, so for them nothing is hidden
 * and none of this costs a query.
 */

import { AppError } from "#/lib/errors";
import type { Collections } from "#/lib/mongo/client.server";
import {
	type AccessEntry,
	type AccessLevel,
	accessFromVisibleTo,
	levelFor,
	reaches,
	roleCeiling,
} from "#/schemas/access";
import type { TeamRole } from "#/schemas/team";

/** What one person may not see where they are working, by id. */
export type Hidden = {
	checklistIds: ReadonlySet<string>;
	tagIds: ReadonlySet<string>;
	trackerIds: ReadonlySet<string>;
	/**
	 * The space's Inbox, whose tasks are seen by their tags; see the top of
	 * this file. `null` where nothing is hidden, so it does not matter.
	 */
	inboxId: string | null;
};

/**
 * What one person may do with each thing they can reach, by id.
 *
 * `null` means nothing narrows them: their own space, or a role that sees
 * everything — and then the role's ceiling applies to all of it.
 */
export type Levels = {
	checklists: ReadonlyMap<string, AccessLevel>;
	tags: ReadonlyMap<string, AccessLevel>;
	trackers: ReadonlyMap<string, AccessLevel>;
} | null;

export const NOTHING_HIDDEN: Hidden = {
	checklistIds: new Set(),
	tagIds: new Set(),
	trackerIds: new Set(),
	inboxId: null,
};

/** What a stored document says its access list is, however it was written. */
type Stored = {
	access?: ReadonlyArray<AccessEntry> | null;
	visibleTo?: ReadonlyArray<string> | null;
};

/**
 * The access list of something read from the database.
 *
 * Anything written before levels existed has `visibleTo` instead: who could
 * see it, with what they could do left to their role. Read as an access list,
 * that is everyone named at Full — which, capped by the role, is exactly what
 * they could already do; see `accessFromVisibleTo`.
 */
function accessOf(stored: Stored): ReadonlyArray<AccessEntry> | null {
	return stored.access ?? accessFromVisibleTo(stored.visibleTo);
}

/**
 * A checklist, tag or tracker as the app reads it: with its access list
 * whichever way it was stored, and without the old field.
 */
export function withAccess<T extends Stored>(
	stored: T,
): Omit<T, "visibleTo"> & { access: ReadonlyArray<AccessEntry> | null } {
	const { visibleTo: _legacy, ...rest } = stored;
	return { ...rest, access: accessOf(stored) };
}

/**
 * What everyone in a team may do with each of its checklists, tags and
 * trackers, and what that leaves them unable to see at all.
 *
 * Three small reads — a space has tens of these, not thousands — rather than a
 * lookup per screen, because every screen needs the whole picture: what to
 * leave out of a list, and what to refuse a change to.
 */
export async function readAccess(
	current: Collections,
	teamId: string,
	email: string,
	role: TeamRole,
): Promise<{ hidden: Hidden; levels: Levels }> {
	const [checklists, tags, trackers] = await Promise.all([
		current.checklists
			.find(
				{ userId: teamId },
				{
					projection: {
						_id: 0,
						checklistId: 1,
						access: 1,
						visibleTo: 1,
						special: 1,
					},
				},
			)
			.toArray(),
		current.tags
			.find(
				{ userId: teamId },
				{
					projection: { _id: 0, tagId: 1, access: 1, visibleTo: 1, special: 1 },
				},
			)
			.toArray(),
		current.trackers
			.find(
				{ userId: teamId },
				{ projection: { _id: 0, trackerId: 1, access: 1, visibleTo: 1 } },
			)
			.toArray(),
	]);

	const ceiling = roleCeiling(role);
	// The Inbox, the Backlog and Today are everyone's, whatever anyone asks for.
	const levelOfItem = (item: Stored & { special?: string | null }) =>
		item.special != null ? ceiling : levelFor(role, email, accessOf(item));

	const byId = <T>(
		items: ReadonlyArray<T & Stored & { special?: string | null }>,
		idOf: (item: T) => string,
	) => {
		const levels = new Map<string, AccessLevel>();
		const hidden = new Set<string>();

		for (const item of items) {
			const level = levelOfItem(item);
			if (level === null) hidden.add(idOf(item));
			else levels.set(idOf(item), level);
		}

		return { levels, hidden };
	};

	const forChecklists = byId(checklists, (each) => each.checklistId);
	const forTags = byId(tags, (each) => each.tagId);
	const forTrackers = byId(trackers, (each) => each.trackerId);

	return {
		hidden: {
			checklistIds: forChecklists.hidden,
			tagIds: forTags.hidden,
			trackerIds: forTrackers.hidden,
			inboxId:
				checklists.find((each) => each.special === "inbox")?.checklistId ??
				null,
		},
		levels: {
			checklists: forChecklists.levels,
			tags: forTags.levels,
			trackers: forTrackers.levels,
		},
	};
}

/** Whether a task is seen, going by where it lives; see the top of this file. */
export function isTaskVisible(
	task: { checklistId: string | null; tagIds: ReadonlyArray<string> },
	hidden: Hidden,
): boolean {
	if (task.checklistId != null && task.checklistId !== hidden.inboxId) {
		return !hidden.checklistIds.has(task.checklistId);
	}

	return (
		task.tagIds.length === 0 ||
		task.tagIds.some((tagId) => !hidden.tagIds.has(tagId))
	);
}

/** Which of the three an id names, for the messages below. */
type Kind = "checklists" | "tags" | "trackers";

const NOUNS: Record<Kind, string> = {
	checklists: "checklist",
	tags: "tag",
	trackers: "tracker",
};

/**
 * What this person may do with one thing, or `null` when it does not exist for
 * them. Outside a team, and for a role that sees everything, it is whatever
 * their role allows.
 */
export function levelOf(
	scope: { team: { role: TeamRole } | null; levels: Levels },
	kind: Kind,
	id: string,
): AccessLevel | null {
	if (scope.team === null) return "full";
	if (scope.levels === null) return roleCeiling(scope.team.role);
	return scope.levels[kind].get(id) ?? null;
}

/**
 * Refuse a change to something this person cannot reach, or cannot reach far
 * enough into. `read` asks only that it exist for them.
 *
 * Something they are not on the list for is answered as deleted, because to
 * them it is: saying "you may not" would confirm that it exists. Something
 * they can see but not change says so plainly, since they can see it.
 */
export function assertLevel(
	scope: { team: { role: TeamRole } | null; levels: Levels },
	kind: Kind,
	id: string,
	needed: AccessLevel,
): void {
	const level = levelOf(scope, kind, id);
	if (level === null) {
		throw new AppError("not_found", `That ${NOUNS[kind]} no longer exists.`);
	}

	if (!reaches(level, needed)) {
		throw new AppError(
			"invalid_data",
			needed === "edit"
				? `You can only read this ${NOUNS[kind]}.`
				: `You can work this ${NOUNS[kind]}, but not change or delete it.`,
		);
	}
}
