/**
 * The AI tools that run the account rather than its content: teams, team
 * messages, notification codes, feedback and backdrops. Server only; see
 * `runAiTool`.
 *
 * None of this is a `Change` in the app either. Each calls what the screen's
 * own server function calls, with the same checks.
 */

import * as v from "valibot";
import { AppError } from "#/lib/errors";
import { createNotificationCode as mintNotificationCode } from "#/lib/ids";
import { createNotificationCodeInputSchema } from "#/schemas/notification-code";
import { roleCan, teamMessageInputSchema } from "#/schemas/team";
import { type AiContext, type AiHandlers, answer } from "./ai-context.server";
import { findChecklist, findTag, findTracker, pick } from "./ai-lookup.server";
import { sendFeedback } from "./feedback.server";
import {
	createNotificationCode,
	deleteNotificationCode,
} from "./notification-code.server";
import { setBackdrop } from "./preferences.server";
import { sendTeamMessage } from "./reminder.server";
import {
	addMember,
	createTeam,
	deleteTeam,
	listTeamDetails,
	removeMember,
	setMemberRole,
} from "./team.server";

/** A team this person is in, by id or name; the one being worked in if none. */
async function findTeam(context: AiContext, ref: string | undefined) {
	const teams = await listTeamDetails(context.scope.email);
	if (ref === undefined) {
		const current = teams.find(
			(team) => team.teamId === context.scope.team?.teamId,
		);
		if (current === undefined) {
			throw new AppError(
				"invalid_data",
				"You are working in your own space. Name the team.",
			);
		}
		return current;
	}
	return pick("team", teams, ref, {
		id: (team) => team.teamId,
		name: (team) => team.name,
	});
}

/** Back to your own space, if the team just left was the one worked in. */
async function leaving(context: AiContext, teamId: string): Promise<boolean> {
	if (context.scope.team?.teamId !== teamId) return false;
	await context.switchSpace(null);
	return true;
}

/** A team's project managers, and its admin, alone can message it. */
function requireMessaging(context: AiContext, what: string) {
	const { team } = context.scope;
	if (team !== null && !roleCan(team.role, "manageContent")) {
		throw new AppError(
			"invalid_data",
			`Only the team's project managers can ${what}.`,
		);
	}
	return team;
}

function checked<TSchema extends v.GenericSchema>(
	schema: TSchema,
	input: v.InferInput<TSchema>,
): v.InferOutput<TSchema> {
	const parsed = v.safeParse(schema, input);
	if (!parsed.success) {
		throw new AppError("invalid_data", parsed.issues[0].message);
	}
	return parsed.output;
}

export const ACCOUNT_TOOLS: AiHandlers<
	| "switch_space"
	| "create_team"
	| "add_team_member"
	| "set_member_role"
	| "remove_team_member"
	| "delete_team"
	| "send_team_message"
	| "create_notification_code"
	| "delete_notification_code"
	| "send_feedback"
	| "set_backdrop"
> = {
	switch_space: async (context, input) => {
		if (input.team === null) {
			await context.switchSpace(null);
			return answer({ space: "your own space" }, true);
		}
		const team = await findTeam(context, input.team);
		await context.switchSpace(team.teamId);
		return answer({ space: team.name, yourRole: team.role }, true);
	},

	create_team: async (context, input) => {
		const teamId = await createTeam(context.scope.email, input.name);
		await context.switchSpace(teamId);
		return answer({ teamId, name: input.name, yourRole: "admin" }, true);
	},

	add_team_member: async (context, input) => {
		const team = await findTeam(context, input.team);
		const role = input.role ?? "collaborator";
		await addMember(team.teamId, context.scope.email, input.email, role);
		return answer({ team: team.name, added: input.email, role });
	},

	set_member_role: async (context, input) => {
		const team = await findTeam(context, input.team);
		await setMemberRole(
			team.teamId,
			context.scope.email,
			input.email,
			input.role,
		);
		return answer({ team: team.name, email: input.email, role: input.role });
	},

	remove_team_member: async (context, input) => {
		const team = await findTeam(context, input.team);
		await removeMember(team.teamId, context.scope.email, input.email);
		const isLeaving = input.email === context.scope.email;
		return answer(
			{ team: team.name, removed: input.email },
			isLeaving && (await leaving(context, team.teamId)),
		);
	},

	delete_team: async (context, input) => {
		const team = await findTeam(context, input.team);
		await deleteTeam(team.teamId, context.scope.email);
		return answer({ deleted: team.name }, await leaving(context, team.teamId));
	},

	send_team_message: async (context, input, look) => {
		const team = requireMessaging(context, "send it messages");
		if (team === null) {
			throw new AppError(
				"invalid_data",
				"Messages go to a team. Switch to one first.",
			);
		}
		const { to } = input;
		const recipients =
			to.kind === "checklist"
				? {
						kind: to.kind,
						checklistId: (await findChecklist(look, to.ref)).checklistId,
					}
				: to.kind === "tag"
					? { kind: to.kind, tagId: (await findTag(look, to.ref)).tagId }
					: to.kind === "tracker"
						? {
								kind: to.kind,
								trackerId: (await findTracker(look, to.ref)).trackerId,
							}
						: to;
		const message = checked(teamMessageInputSchema, {
			to: recipients,
			title: input.title,
			body: input.body,
		});
		return answer(
			await sendTeamMessage(team.teamId, message, context.scope.hidden),
		);
	},

	create_notification_code: async (context, input) => {
		const team = requireMessaging(context, "make notification codes");
		const code = mintNotificationCode();
		await createNotificationCode(
			context.scope.ownerId,
			context.scope.email,
			team,
			checked(createNotificationCodeInputSchema, {
				code,
				label: input.label,
				to: input.to,
			}),
		);
		return answer({
			code,
			label: input.label,
			usage:
				'POST /api/notify with JSON { "code": "<code>", "title": "…", "body": "…", "url": "/tags/today" }',
		});
	},

	delete_notification_code: async (context, input) => {
		requireMessaging(context, "have notification codes");
		await deleteNotificationCode(
			context.scope.ownerId,
			context.scope.email,
			input.code,
		);
		return answer({ deleted: true });
	},

	send_feedback: async (context, input) => {
		await sendFeedback(context.person, input.message);
		return answer({ sent: true });
	},

	set_backdrop: async (context, input) => {
		await setBackdrop(context.person.userId, {
			page: input.section,
			design: input.design,
			palette: input.palette,
		});
		return answer({ section: input.section });
	},
};
