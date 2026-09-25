import { createServerFn } from "@tanstack/react-start";
import {
	listReminders,
	pushPublicKey,
	removePushSubscription,
	savePushSubscription,
	sendTestPush,
} from "#/data/reminder.server";
import {
	pushEndpointInputSchema,
	pushSubscriptionInputSchema,
} from "#/schemas/reminder";
import { validator } from "#/schemas/validate";
import { guard } from "./guard";
import { requireScope } from "./scope";

/** This person's reminders: the day's, and the ones in this space. */
export const listRemindersFn = createServerFn().handler(() =>
	guard("listReminders", async () => {
		const scope = await requireScope();
		return listReminders(scope.ownerId, scope.email);
	}),
);

/**
 * The key a browser subscribes with, or `null` while the server has none —
 * which is how the Settings screen knows to say notifications are not set up.
 */
export const getPushKeyFn = createServerFn().handler(() =>
	guard("getPushKey", async () => {
		await requireScope();
		return pushPublicKey();
	}),
);

/** Turn notifications on for this device. */
export const savePushSubscriptionFn = createServerFn({ method: "POST" })
	.validator(validator(pushSubscriptionInputSchema))
	.handler(({ data }) =>
		guard("savePushSubscription", async () => {
			const scope = await requireScope();
			await savePushSubscription(scope.email, data);
		}),
	);

/** Turn them off again. */
export const removePushSubscriptionFn = createServerFn({ method: "POST" })
	.validator(validator(pushEndpointInputSchema))
	.handler(({ data }) =>
		guard("removePushSubscription", async () => {
			const scope = await requireScope();
			await removePushSubscription(scope.email, data.endpoint);
		}),
	);

/** A notification now, to every device of this person's. How many took it. */
export const sendTestPushFn = createServerFn({ method: "POST" }).handler(() =>
	guard("sendTestPush", async () => sendTestPush((await requireScope()).email)),
);
