/**
 * Turning notifications on and off for this device.
 *
 * A device is a push subscription: the browser's promise to wake the service
 * worker when the server sends to it, even with the app closed. It needs the
 * service worker, so it works in the installed app and in a production build
 * — on an iPhone only once the app is added to the home screen.
 */

import {
	removePushSubscriptionFn,
	savePushSubscriptionFn,
} from "#/functions/reminder.functions";

/** Whether this browser can take notifications at all. */
export function canPush(): boolean {
	return (
		typeof window !== "undefined" &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		"Notification" in window
	);
}

/** The server's key, as `pushManager.subscribe` wants it. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
	const padded = `${base64url}${"=".repeat((4 - (base64url.length % 4)) % 4)}`;
	const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
	const bytes = new Uint8Array(new ArrayBuffer(raw.length));
	for (let index = 0; index < raw.length; index += 1) {
		bytes[index] = raw.charCodeAt(index);
	}
	return bytes;
}

/** This device's subscription, if notifications are on for it. */
export async function currentSubscription(): Promise<PushSubscription | null> {
	if (!canPush()) return null;
	const registration = await navigator.serviceWorker.getRegistration();
	return (await registration?.pushManager.getSubscription()) ?? null;
}

/**
 * Ask to show notifications, subscribe, and tell the server. Resolves to what
 * became of it, so the screen can say so.
 */
export async function turnOnPush(
	publicKey: string,
): Promise<"on" | "denied" | "unavailable"> {
	if (!canPush()) return "unavailable";

	const permission = await Notification.requestPermission();
	if (permission !== "granted") return "denied";

	const registration = await navigator.serviceWorker.getRegistration();
	if (registration === undefined) return "unavailable";

	const subscription =
		(await registration.pushManager.getSubscription()) ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: keyBytes(publicKey),
		}));

	const { endpoint, keys } = subscription.toJSON();
	if (!endpoint || !keys?.p256dh || !keys.auth) return "unavailable";

	await savePushSubscriptionFn({
		data: { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
	});
	return "on";
}

/** Stop this device's notifications, here and on the server. */
export async function turnOffPush(): Promise<void> {
	const subscription = await currentSubscription();
	if (subscription === null) return;

	await removePushSubscriptionFn({ data: { endpoint: subscription.endpoint } });
	await subscription.unsubscribe();
}

/** The browser's time zone, which a reminder's time is read in. */
export function browserTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
