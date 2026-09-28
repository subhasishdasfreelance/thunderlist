/**
 * Notification codes, and notifying with one. Server only; see
 * `NotificationCode` for what each kind reaches.
 *
 * A code is its maker's: they list, make and delete their own, in the space
 * they made it in. Whoever holds one can use it, from anywhere, through
 * `/api/notify` — so what it reaches is worked out again at every use, from
 * the team as it is then, not as it was when the code was made.
 */

import { AppError } from "#/lib/errors";
import { collections } from "#/lib/mongo/client.server";
import type {
	CreateNotificationCodeInput,
	NotificationCode,
	NotifyInput,
} from "#/schemas/notification-code";
import { roleCan, storedRole } from "#/schemas/team";
import { MESSAGE_TTL, pushPublicKey, sendTo } from "./reminder.server";

/** This person's codes in this space, newest first. */
export async function listNotificationCodes(
	ownerId: string,
	email: string,
): Promise<Array<NotificationCode>> {
	const current = await collections();
	return current.notificationCodes
		.find(
			{ userId: ownerId, createdBy: email },
			{
				projection: {
					_id: 0,
					code: 1,
					label: 1,
					to: 1,
					createdAt: 1,
					lastUsedAt: 1,
				},
			},
		)
		.sort({ createdAt: -1 })
		.toArray();
}

/**
 * Make a code, once however often it is sent. `team` is the team being
 * worked in, with everyone in it, or `null` for this person's own space.
 */
export async function createNotificationCode(
	ownerId: string,
	email: string,
	team: { teamId: string; emails: Array<string> } | null,
	input: CreateNotificationCodeInput,
): Promise<void> {
	const current = await collections();
	const { to } = input;

	if (to.kind === "team" && team === null) {
		throw new AppError(
			"invalid_data",
			"A code for a whole team is made while working in that team.",
		);
	}
	if (to.kind === "person") {
		const reachable = team === null ? [email] : team.emails;
		if (!reachable.includes(to.email)) {
			throw new AppError(
				"invalid_data",
				team === null
					? "In your own space, a code can only notify you."
					: "That person is not in this team.",
			);
		}
	}
	if (to.kind === "device") {
		const device = await current.pushSubscriptions.findOne({
			email,
			endpoint: to.endpoint,
		});
		if (device === null) {
			throw new AppError(
				"invalid_data",
				"Turn notifications on for this device first.",
			);
		}
	}

	await current.notificationCodes.updateOne(
		{ code: input.code, userId: ownerId, createdBy: email },
		{
			$setOnInsert: {
				label: input.label,
				to,
				teamId: team?.teamId ?? null,
				createdAt: new Date().toISOString(),
				lastUsedAt: null,
			},
		},
		{ upsert: true },
	);
}

export async function deleteNotificationCode(
	ownerId: string,
	email: string,
	code: string,
): Promise<void> {
	const current = await collections();
	await current.notificationCodes.deleteOne({
		code,
		userId: ownerId,
		createdBy: email,
	});
}

/**
 * Notify whoever a code reaches, on every device of theirs it covers. One that
 * is off gets it once it is back on, within four weeks. Returns how many
 * people and how many devices took it.
 *
 * A team's code works only while whoever made it can still message the team,
 * and reaches only the people in it now.
 */
export async function notifyWithCode(
	input: NotifyInput,
): Promise<{ people: number; devices: number }> {
	const current = await collections();
	const found = await current.notificationCodes.findOne({ code: input.code });
	if (found === null) {
		throw new AppError("not_found", "No notification code matches that one.");
	}
	if (pushPublicKey() === null) {
		throw new AppError(
			"not_configured",
			"Notifications are not set up on this server yet.",
		);
	}

	let teamEmails: Array<string> = [];
	if (found.teamId !== null) {
		const members = await current.members
			.find(
				{ teamId: found.teamId },
				{ projection: { _id: 0, email: 1, role: 1 } },
			)
			.toArray();
		const maker = members.find((member) => member.email === found.createdBy);
		if (!maker || !roleCan(storedRole(maker.role), "manageContent")) {
			throw new AppError(
				"unauthorized",
				"This code no longer works: whoever made it can no longer message the team.",
			);
		}
		teamEmails = members.map((member) => member.email);
	}

	const { to } = found;
	const recipients: Array<{ email: string; endpoint?: string }> =
		to.kind === "device"
			? [{ email: found.createdBy, endpoint: to.endpoint }]
			: to.kind === "person"
				? found.teamId === null || teamEmails.includes(to.email)
					? [{ email: to.email }]
					: []
				: teamEmails.map((email) => ({ email }));

	const message = {
		title: input.title,
		body: input.body,
		url: input.url ?? "/tags/today",
		image: input.image,
	};

	let people = 0;
	let devices = 0;
	for (const devicesOf of recipients) {
		const sent = await sendTo(devicesOf, message, MESSAGE_TTL);
		if (sent > 0) people += 1;
		devices += sent;
	}

	await current.notificationCodes.updateOne(
		{ code: found.code },
		{ $set: { lastUsedAt: new Date().toISOString() } },
	);
	return { people, devices };
}
