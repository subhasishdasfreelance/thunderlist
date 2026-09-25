/**
 * Daily reminders, and the devices they are sent to. Server only.
 *
 * A reminder is one person's: the day's is the same in every space, and one
 * about a checklist, tracker or tag belongs to the space that thing is in. A
 * device is a push subscription, kept per person, so a reminder reaches every
 * device they turned notifications on for.
 *
 * Sending is `sendDueReminders`, run by a scheduler calling `/api/reminders`
 * every few minutes; each reminder goes out at most once a day.
 */

import webpush from "web-push";
import { collections } from "#/lib/mongo/client.server";
import { isDue, type Reminder, type ReminderTarget } from "#/schemas/reminder";
import { storedRole, type TeamMessageInput } from "#/schemas/team";

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

/** This person's reminders: the day's, and the ones in this space. */
export async function listReminders(
	ownerId: string,
	email: string,
): Promise<Array<Reminder>> {
	const current = await collections();
	const found = await current.reminders
		.find(
			{ email, $or: [{ ownerId }, { ownerId: null }] },
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
		targetId: string | null;
		time: string | null;
		timeZone: string;
	},
): Promise<void> {
	const current = await collections();
	const key = {
		email,
		// The day's is the person's everywhere; the rest are the space's.
		ownerId: input.target === "day" ? null : ownerId,
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

type Message = { title: string; body: string; url: string };

/**
 * Send one message to every device a person has, forgetting any device the
 * push service says is gone. Returns how many took it.
 *
 * `ttl` is how long, in seconds, the push service holds it for a device that
 * is off: a reminder is stale within the hour; a message is not.
 */
async function sendTo(
	email: string,
	message: Message,
	ttl = 60 * 60,
): Promise<number> {
	const keys = pushKeys();
	if (keys === null) return 0;

	const current = await collections();
	const devices = await current.pushSubscriptions.find({ email }).toArray();

	webpush.setVapidDetails(
		process.env.VAPID_SUBJECT?.trim() ||
			process.env.BETTER_AUTH_URL?.trim() ||
			"mailto:reminders@thunderlist.app",
		keys.publicKey,
		keys.privateKey,
	);

	let sent = 0;
	for (const device of devices) {
		try {
			await webpush.sendNotification(
				{ endpoint: device.endpoint, keys: device.keys },
				JSON.stringify(message),
				{ TTL: ttl },
			);
			sent += 1;
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
		}
	}
	return sent;
}

/** As long as the push services will hold a message: four weeks. */
const MESSAGE_TTL = 60 * 60 * 24 * 28;

/**
 * A message from a project manager to the people of their team it names, on
 * every device each of them has turned notifications on for. One that is off
 * gets it once it is back on, within four weeks. Returns how many people and
 * how many devices took it — a person with no device has nothing to take it.
 */
export async function sendTeamMessage(
	teamId: string,
	input: TeamMessageInput,
): Promise<{ people: number; devices: number }> {
	const current = await collections();
	const members = await current.members
		.find({ teamId }, { projection: { _id: 0, email: 1, role: 1 } })
		.toArray();

	const { to } = input;
	const recipients = members
		.filter((member) =>
			to.kind === "team"
				? true
				: to.kind === "role"
					? storedRole(member.role) === to.role
					: member.email === to.email,
		)
		.map((member) => member.email);

	let people = 0;
	let devices = 0;
	for (const email of recipients) {
		const sent = await sendTo(
			email,
			{ title: input.title, body: input.body, url: "/tags/today" },
			MESSAGE_TTL,
		);
		if (sent > 0) people += 1;
		devices += sent;
	}
	return { people, devices };
}

/** A notification now, to check this person's devices get them. */
export async function sendTestPush(email: string): Promise<number> {
	return sendTo(email, {
		title: "Thunderlist",
		body: "Notifications are on. Your reminders will arrive like this.",
		url: "/settings",
	});
}

/** What a reminder says, and where it opens. */
async function messageFor(reminder: {
	ownerId: string | null;
	target: ReminderTarget;
	targetId: string | null;
}): Promise<Message | null> {
	const current = await collections();
	const { ownerId, targetId } = reminder;

	switch (reminder.target) {
		case "day":
			return {
				title: "Time to review your day",
				body: "See what is on Today, and what is left.",
				url: "/tags/today",
			};
		case "checklist": {
			const found = await current.checklists.findOne(
				{ userId: ownerId ?? "", checklistId: targetId ?? "" },
				{ projection: { _id: 0, title: 1 } },
			);
			return found === null
				? null
				: {
						title: `Review ${found.title}`,
						body: "Open it to see what is left.",
						url: `/checklists/${targetId}`,
					};
		}
		case "tracker": {
			const found = await current.trackers.findOne(
				{ userId: ownerId ?? "", trackerId: targetId ?? "" },
				{ projection: { _id: 0, title: 1 } },
			);
			return found === null
				? null
				: {
						title: `Log progress on ${found.title}`,
						body: "Where have you got to today?",
						url: `/trackers/${targetId}`,
					};
		}
		case "tag": {
			const found = await current.tags.findOne(
				{ userId: ownerId ?? "", tagId: targetId ?? "" },
				{ projection: { _id: 0, name: 1, special: 1 } },
			);
			return found === null
				? null
				: {
						title: `Review #${found.name}`,
						body: "Open it to see what is left.",
						url: `/tags/${found.special === "today" ? "today" : targetId}`,
					};
		}
	}
}

/**
 * Send every reminder whose time has come, once each per day on its own
 * clock. A reminder about something since deleted is deleted with it.
 */
export async function sendDueReminders(
	now: Date,
): Promise<{ due: number; sent: number }> {
	const current = await collections();
	const reminders = await current.reminders.find({}).toArray();

	let due = 0;
	let sent = 0;
	for (const reminder of reminders) {
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
		sent += await sendTo(reminder.email, message);
	}

	return { due, sent };
}
