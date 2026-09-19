import * as v from "valibot";
import { emailSchema } from "./common";
import { roleCan, type TeamRole } from "./team";

/**
 * What one person may do with one checklist, one tag or one tracker.
 *
 * A role says what someone may do in a team at all; this says what they may do
 * with a particular piece of work in it. The two are read together and the
 * smaller of them wins, so an access list can never hand out more than a role
 * allows — a collaborator given **Full** on a checklist still adds and deletes
 * nothing, because that is not theirs to do anywhere.
 *
 * - **Read** — sees it and everything in it. Changes nothing.
 * - **Edit** — ticks its tasks, moves them along their stages, edits, flags
 *   and takes them on; records a tracker's readings.
 * - **Full** — all of that, and adds and deletes tasks, moves them between
 *   checklists, and changes or deletes the thing itself, who can see it
 *   included.
 *
 * Someone who is not on the list at all does not see it: to them it does not
 * exist, exactly as before; see `visibility.server.ts`.
 */
export const ACCESS_LEVELS = ["read", "edit", "full"] as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_LABELS: Record<AccessLevel, string> = {
	read: "Read",
	edit: "Edit",
	full: "Full",
};

/** One line each, for wherever a level is picked or explained. */
export const ACCESS_SUMMARIES: Record<AccessLevel, string> = {
	read: "Sees it. Changes nothing.",
	edit: "Ticks and updates its tasks. Adds and deletes nothing.",
	full: "Adds and deletes tasks, and can change or delete it.",
};

const accessEntrySchema = v.object({
	email: emailSchema,
	level: v.picklist(ACCESS_LEVELS),
});

/** One person, and what they may do with one thing. */
export type AccessEntry = v.InferOutput<typeof accessEntrySchema>;

/**
 * Who may do what with a checklist, a tag or a tracker — or `null` for the
 * whole team, each at whatever their role allows.
 *
 * `null` is what everything made before this existed has, and what the Inbox,
 * the Backlog and Today always have: they are everyone's. Anything made since
 * starts with its author alone on the list, so adding someone to a team gives
 * them nothing until they are put on something.
 */
export const accessSchema = v.nullable(
	v.pipe(v.array(accessEntrySchema), v.maxLength(200, "Too many people")),
);

/** Least first, so two levels can be compared. */
function rank(level: AccessLevel): number {
	return ACCESS_LEVELS.indexOf(level);
}

/** The lower of two levels; see the top of this file. */
function lowerOf(a: AccessLevel, b: AccessLevel): AccessLevel {
	return rank(a) <= rank(b) ? a : b;
}

/** As far as a role reaches, however much an access list hands it. */
export function roleCeiling(role: TeamRole): AccessLevel {
	if (roleCan(role, "manageContent")) return "full";
	return roleCan(role, "updateTasks") ? "edit" : "read";
}

/**
 * What this person may do with one checklist, tag or tracker — or `null` when
 * it does not exist for them.
 *
 * The admin and viewers see everything whatever a list says, as they always
 * have; everyone else sees what names them, at the lower of what the list
 * gives and what their role allows.
 */
export function levelFor(
	role: TeamRole,
	email: string,
	access: ReadonlyArray<AccessEntry> | null | undefined,
): AccessLevel | null {
	const ceiling = roleCeiling(role);
	if (roleCan(role, "seeEverything")) return ceiling;
	if (access == null) return ceiling;

	const mine = access.find((entry) => entry.email === email);
	return mine === undefined ? null : lowerOf(mine.level, ceiling);
}

/** Whether a level goes at least as far as another; see the top of this file. */
export function reaches(level: AccessLevel, needed: AccessLevel): boolean {
	return rank(level) >= rank(needed);
}

/**
 * An access list read from an older document, which named who could see
 * something and left what they could do to their role alone.
 *
 * "Full" is not a promotion: it is capped by the role on every read, so this
 * is exactly what those people could already do.
 */
export function accessFromVisibleTo(
	visibleTo: ReadonlyArray<string> | null | undefined,
): Array<AccessEntry> | null {
	return visibleTo == null
		? null
		: visibleTo.map((email) => ({ email, level: "full" as const }));
}
