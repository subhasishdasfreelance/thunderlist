/**
 * Daily reminders, and the devices they are sent to. Server only.
 *
 * A reminder is one person's, about a checklist, tracker or tag, and belongs
 * to the space that thing is in. A
 * device is a push subscription, kept per person, so a reminder reaches every
 * device they turned notifications on for.
 *
 * Sending is `sendDueReminders`, run by a scheduler calling `/api/reminders`
 * every few minutes; each reminder goes out at most once a day.
 */

import webpush from "web-push";
import { AppError } from "#/lib/errors";
import {
	collections,
	type PushSubscriptionDoc,
} from "#/lib/mongo/client.server";
import { type AccessEntry, levelFor } from "#/schemas/access";
import { isDue, type Reminder, type ReminderTarget } from "#/schemas/reminder";
import {
	type MessageRecipients,
	storedRole,
	type TeamMessageInput,
} from "#/schemas/team";
import {
	type Hidden,
	isTaskVisible,
	readAccess,
	withAccess,
} from "./visibility.server";

/** The server's push keys, or `null` while none are configured. */
function pushKeys(): { publicKey: string; privateKey: string } | null {
	const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
	const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
	return publicKey && privateKey ? { publicKey, privateKey } : null;
}

/** What a browser needs to subscribe: the public key, or `null` if none. */
export function pushPublicKey(): string | null {
	return pushKeys()?.publicKey ?? null;
}

/** This person's reminders in this space. */
export async function listReminders(
	ownerId: string,
	email: string,
): Promise<Array<Reminder>> {
	const current = await collections();
	const found = await current.reminders
		.find(
			{ email, ownerId },
			{ projection: { _id: 0, target: 1, targetId: 1, time: 1 } },
		)
		.toArray();

	return found.map(({ target, targetId, time }) => ({
		target,
		targetId,
		time,
	}));
}

/** Set one reminder, or take it away with `time: null`. */
export async function setReminder(
	ownerId: string,
	email: string,
	input: {
		target: ReminderTarget;
		targetId: string;
		time: string | null;
		timeZone: string;
	},
): Promise<void> {
	const current = await collections();
	const key = {
		email,
		ownerId,
		target: input.target,
		targetId: input.targetId,
	};

	if (input.time === null) {
		await current.reminders.deleteOne(key);
		return;
	}

	await current.reminders.updateOne(
		key,
		// A new time is a new promise: today's may still be due.
		{ $set: { time: input.time, timeZone: input.timeZone, lastSentOn: null } },
		{ upsert: true },
	);
}

export async function savePushSubscription(
	email: string,
	subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
	const current = await collections();
	await current.pushSubscriptions.updateOne(
		{ endpoint: subscription.endpoint },
		{
			$set: { email, keys: subscription.keys },
			$setOnInsert: { createdAt: new Date().toISOString() },
		},
		{ upsert: true },
	);
}

export async function removePushSubscription(
	email: string,
	endpoint: string,
): Promise<void> {
	const current = await collections();
	await current.pushSubscriptions.deleteOne({ email, endpoint });
}

/** What the service worker shows; `image` is a picture shown large. */
type Message = { title: string; body: string; url: string; image?: string };

/**
 * Send one message to every device a person has — or just the one `endpoint`
 * names — forgetting any device the push service says is gone. Returns how
 * many took it.
 *
 * `ttl` is how long, in seconds, the push service holds it for a device that
 * is off: a reminder is stale within the hour; a message is not.
 */
export async function sendTo(
	devices: { email: string; endpoint?: string },
	message: Message,
	ttl = 60 * 60,
): Promise<number> {
	if (pushKeys() === null) return 0;

	const current = await collections();
	const found = await current.pushSubscriptions.find(devices).toArray();
	return (await pushTo(found, message, ttl)).length;
}

/**
 * Send one message to every device each of these people has, their devices
 * read in one go and sent to side by side, rather than a read and a round of
 * sends a person. Returns how many people and devices took it.
 */
export async function sendToEach(
	emails: ReadonlyArray<string>,
	message: Message,
	ttl = 60 * 60,
): Promise<{ people: number; devices: number }> {
	if (pushKeys() === null || emails.length === 0) {
		return { people: 0, devices: 0 };
	}

	const current = await collections();
	const found = await current.pushSubscriptions
		.find({ email: { $in: [...emails] } })
		.toArray();
	const took = await pushTo(found, message, ttl);
	return {
		people: new Set(took.map((device) => device.email)).size,
		devices: took.length,
	};
}

/**
 * Send a message to these devices, side by side, forgetting any the push
 * service says is gone. Returns the ones that took it.
 */
async function pushTo(
	found: ReadonlyArray<PushSubscriptionDoc>,
	message: Message,
	ttl: number,
): Promise<Array<PushSubscriptionDoc>> {
	const keys = pushKeys();
	if (keys === null || found.length === 0) return [];

	const current = await collections();
	webpush.setVapidDetails(
		process.env.VAPID_SUBJECT?.trim() ||
			process.env.BETTER_AUTH_URL?.trim() ||
			"mailto:reminders@thunderlist.app",
		keys.publicKey,
		keys.privateKey,
	);

	const sent = await Promise.all(
		found.map(async (device) => {
			try {
				await webpush.sendNotification(
					{ endpoint: device.endpoint, keys: device.keys },
					JSON.stringify(message),
					{ TTL: ttl },
				);
				return device;
			} catch (error) {
				const status = (error as { statusCode?: number }).statusCode;
				// Unsubscribed, or the app uninstalled: nothing will ever take it.
				if (status === 404 || status === 410) {
					await current.pushSubscriptions.deleteOne({
						endpoint: device.endpoint,
					});
				} else {
					console.error("[thunderlist] push failed:", status ?? error);
				}
				return null;
			}
		}),
	);
	return sent.filter((device) => device !== null);
}

/** As long as the push services will hold a message: four weeks. */
export const MESSAGE_TTL = 60 * 60 * 24 * 28;

/** What an access list is read from, as stored. */
type Listed = {
	access?: ReadonlyArray<AccessEntry> | null;
	visibleTo?: ReadonlyArray<string> | null;
	special?: string | null;
};

/**
 * The checklist, tag or tracker a message is sent to the people of, with the
 * page it opens — `null` for a message to anyone else. Refused as deleted when
 * it is gone, or kept from the sender.
 */
async function messagedItem(
	teamId: string,
	to: MessageRecipients,
	hidden: Hidden,
): Promise<{ found: Listed; url: string } | null> {
	const current = await collections();
	const ACCESS = { _id: 0, access: 1, visibleTo: 1, special: 1 } as const;

	switch (to.kind) {
		case "checklist": {
			const found = hidden.checklistIds.has(to.checklistId)
				? null
				: await current.checklists.findOne(
						{ userId: teamId, checklistId: to.checklistId },
						{ projection: ACCESS },
					);
			if (found === null) {
				throw new AppError("not_found", "That checklist no longer exists.");
			}
			return { found, url: `/checklists/${to.checklistId}` };
		}
		case "tag": {
			const found = hidden.tagIds.has(to.tagId)
				? null
				: await current.tags.findOne(
						{ userId: teamId, tagId: to.tagId },
						{ projection: ACCESS },
					);
			if (found === null) {
				throw new AppError("not_found", "That tag no longer exists.");
			}
			return {
				found,
				url: `/tags/${found.special === "today" ? "today" : to.tagId}`,
			};
		}
		case "tracker": {
			const found = hidden.trackerIds.has(to.trackerId)
				? null
				: await current.trackers.findOne(
						{ userId: teamId, trackerId: to.trackerId },
						{ projection: { _id: 0, access: 1, visibleTo: 1 } },
					);
			if (found === null) {
				throw new AppError("not_found", "That tracker no longer exists.");
			}
			return { found, url: `/trackers/${to.trackerId}` };
		}
		default:
			return null;
	}
}

/**
 * A message from a project manager to the people of their team it names, on
 * every device each of them has turned notifications on for. One that is off
 * gets it once it is back on, within four weeks. Returns how many people and
 * how many devices took it — a person with no device has nothing to take it.
 *
 * Sent to a checklist, a tag or a tracker, it goes to everyone who can see
 * that, and opens it; see `levelFor`.
 */
export async function sendTeamMessage(
	teamId: string,
	input: TeamMessageInput,
	hidden: Hidden,
): Promise<{ people: number; devices: number }> {
	const current = await collections();
	const members = await current.members
		.find({ teamId }, { projection: { _id: 0, email: 1, role: 1 } })
		.toArray();

	const { to } = input;
	const item = await messagedItem(teamId, to, hidden);
	// The Inbox, the Backlog and Today are everyone's, whatever they say.
	const canSee = (member: { email: string; role: string }) =>
		item === null ||
		item.found.special != null ||
		levelFor(
			storedRole(member.role),
			member.email,
			withAccess(item.found).access,
		) !== null;

	const recipients = members
		.filter((member) =>
			to.kind === "team"
				? true
				: to.kind === "role"
					? storedRole(member.role) === to.role
					: to.kind === "person"
						? member.email === to.email
						: canSee(member),
		)
		.map((member) => member.email);
	const url = item?.url ?? "/tags/today";

	return sendToEach(
		recipients,
		{ title: input.title, body: input.body, url },
		MESSAGE_TTL,
	);
}

/**
 * Tell everyone a task has just been given to, on every device they turned
 * notifications on for; tapping it opens the task. `before` is who had it
 * already, who have nothing new to hear.
 *
 * Not whoever did the assigning — they know — and not anyone the task is
 * kept from, whom it would tell its title; see `isTaskVisible`.
 */
export async function sendAssigned(
	teamId: string,
	actor: string,
	taskId: string,
	before: ReadonlyArray<string>,
): Promise<void> {
	await sendAssignedMany(teamId, actor, [{ taskId, before }]);
}

/**
 * The same for many tasks given at once — a pick assigned together; see
 * `task.batch`. Each person hears once, however many they were given: one
 * task by its title, as `sendAssigned` says it, and several as how many,
 * opening on their own tasks. The tasks, the people and who did it are read
 * once for all of them, and each person's access once.
 */
export async function sendAssignedMany(
	teamId: string,
	actor: string,
	given: ReadonlyArray<{ taskId: string; before: ReadonlyArray<string> }>,
): Promise<void> {
	if (given.length === 0) return;

	const current = await collections();
	const tasks = await current.tasks
		.find(
			{ userId: teamId, taskId: { $in: given.map((each) => each.taskId) } },
			{
				projection: {
					_id: 0,
					taskId: 1,
					title: 1,
					assignees: 1,
					checklistId: 1,
					tagIds: 1,
				},
			},
		)
		.toArray();

	// Who is new on each task, and so the tasks each person was given.
	const byPerson = new Map<string, Array<(typeof tasks)[number]>>();
	for (const task of tasks) {
		const before =
			given.find((each) => each.taskId === task.taskId)?.before ?? [];
		for (const email of task.assignees ?? []) {
			if (email === actor || before.includes(email)) continue;
			byPerson.set(email, [...(byPerson.get(email) ?? []), task]);
		}
	}
	if (byPerson.size === 0) return;

	const [account, members] = await Promise.all([
		current.users.findOne(
			{ email: actor },
			{ projection: { _id: 0, name: 1 } },
		),
		current.members
			.find(
				{ teamId, email: { $in: [...byPerson.keys()] } },
				{ projection: { _id: 0, email: 1, role: 1 } },
			)
			.toArray(),
	]);
	const who = account?.name ?? actor;

	await Promise.all(
		members.map(async (member) => {
			const { hidden } = await readAccess(
				current,
				teamId,
				member.email,
				storedRole(member.role),
			);
			const visible = (byPerson.get(member.email) ?? []).filter((task) =>
				isTaskVisible(task, hidden),
			);
			const [first] = visible;
			if (first === undefined) return;

			if (visible.length === 1) {
				await sendTo(
					{ email: member.email },
					{
						title: `${who} gave you a task`,
						body: first.title,
						url:
							first.checklistId === null
								? "/tags/today"
								: `/checklists/${first.checklistId}?task=${first.taskId}`,
					},
					MESSAGE_TTL,
				);
				return;
			}

			// Their own tasks: in the one checklist all of them are in, or
			// across every list.
			const mine = `who=${encodeURIComponent(member.email)}`;
			const isOneChecklist =
				first.checklistId !== null &&
				visible.every((task) => task.checklistId === first.checklistId);
			const titles = visible.slice(0, 2).map((task) => task.title);
			const more = visible.length - titles.length;
			await sendTo(
				{ email: member.email },
				{
					title: `${who} gave you ${visible.length} tasks`,
					body:
						more > 0
							? `${titles.join(", ")} and ${more} more`
							: titles.join(", "),
					url: isOneChecklist
						? `/checklists/${first.checklistId}?${mine}`
						: `/stages?${mine}`,
				},
				MESSAGE_TTL,
			);
		}),
	);
}

/** A notification now, to check this one device of this person's gets them. */
export async function sendTestPush(
	email: string,
	endpoint: string,
): Promise<number> {
	return sendTo(
		{ email, endpoint },
		{
			title: "Thunderlist",
			body: "Notifications are on. Your reminders will arrive like this.",
			url: "/settings",
		},
	);
}

/**
 * Whether a reminder's person may still see what it is about. In their own
 * space, always. In a team they can be taken out of it, or off that thing's
 * list, after setting it — and the reminder must not go on telling them its
 * name.
 */
async function canStillSee(
	reminder: { ownerId: string; email: string },
	item: Listed,
): Promise<boolean> {
	const current = await collections();
	const team = await current.teams.findOne(
		{ teamId: reminder.ownerId },
		{ projection: { _id: 0, teamId: 1 } },
	);
	if (team === null) return true;

	const member = await current.members.findOne(
		{ teamId: reminder.ownerId, email: reminder.email },
		{ projection: { _id: 0, role: 1 } },
	);
	if (member === null) return false;

	// Today is everyone's, whatever it says; see `readAccess`.
	return (
		item.special != null ||
		levelFor(
			storedRole(member.role),
			reminder.email,
			withAccess(item).access,
		) !== null
	);
}

/**
 * What a reminder says, and where it opens — `null` once what it is about is
 * gone, or gone for its person; see `canStillSee`.
 */
async function messageFor(reminder: {
	ownerId: string;
	email: string;
	target: ReminderTarget;
	targetId: string;
}): Promise<Message | null> {
	const current = await collections();
	const { ownerId, targetId } = reminder;
	const ACCESS = { access: 1, visibleTo: 1 } as const;

	switch (reminder.target) {
		case "tracker": {
			const found = await current.trackers.findOne(
				{ userId: ownerId, trackerId: targetId },
				{ projection: { _id: 0, title: 1, ...ACCESS } },
			);
			return found === null || !(await canStillSee(reminder, found))
				? null
				: {
						title: `Log progress on ${found.title}`,
						body: "Where have you got to today?",
						url: `/trackers/${targetId}`,
					};
		}
		case "tag": {
			const found = await current.tags.findOne(
				{ userId: ownerId, tagId: targetId },
				{ projection: { _id: 0, name: 1, special: 1, ...ACCESS } },
			);
			return found === null || !(await canStillSee(reminder, found))
				? null
				: {
						title: `Review #${found.name}`,
						body: "Open it to see what is left.",
						url: `/tags/${found.special === "today" ? "today" : targetId}`,
					};
		}
		// The daily review and a checklist's reminder, no longer offered:
		// deleted as they come due.
		default:
			return null;
	}
}

/**
 * Send every reminder whose time has come, once each per day on its own
 * clock. A reminder about something since deleted, or since kept from its
 * person, is deleted with it.
 */
export async function sendDueReminders(
	now: Date,
): Promise<{ due: number; sent: number }> {
	const current = await collections();
	const reminders = await current.reminders.find({}).toArray();

	let due = 0;
	let sent = 0;
	for (const reminder of reminders) {
		// One that cannot be worked out — a time zone this server does not
		// know — is skipped rather than stopping everyone's after it.
		try {
			const { isDue: isNow, today } = isDue(reminder, now);
			if (!isNow) continue;
			due += 1;

			const message = await messageFor(reminder);
			if (message === null) {
				await current.reminders.deleteOne({ _id: reminder._id });
				continue;
			}

			// Marked first: a slow push service must not make the next run send
			// the same reminder again.
			await current.reminders.updateOne(
				{ _id: reminder._id },
				{ $set: { lastSentOn: today } },
			);
			sent += await sendTo({ email: reminder.email }, message);
		} catch (error) {
			console.error("[thunderlist] reminder failed:", error);
		}
	}

	return { due, sent };
}
