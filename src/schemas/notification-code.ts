import * as v from "valibot";
import { emailSchema } from "./common";

/**
 * A notification code: a secret that, sent to `/api/notify` with a title and
 * a message, notifies whoever it was made for. Something outside the app — a
 * script, a deploy, a form — can then notify people without signing in.
 *
 * There are three, by who they reach:
 *
 * - `device` — the one browser it was made on, and nothing else.
 * - `person` — one person, on every device they turned notifications on for.
 *   In your own space that is you; in a team, anyone in it.
 * - `team` — everyone in the team, as it is when the code is used.
 *
 * In your own space anyone can make them. In a team only its project managers
 * and its admin can, as only they can message it, and a team's code stops
 * working once whoever made it no longer can.
 */
export const CODE_KINDS = ["device", "person", "team"] as const;

export type CodeKind = (typeof CODE_KINDS)[number];

/** `ntf_` and 32 random characters: nothing in it to guess from. */
export const notificationCodeSchema = v.pipe(
	v.string(),
	v.trim(),
	v.regex(/^ntf_[0-9a-z]{32}$/, "That is not a notification code"),
);

export const codeRecipientsSchema = v.variant("kind", [
	v.object({
		kind: v.literal("device"),
		/** The push subscription of the device it was made on. */
		endpoint: v.pipe(v.string(), v.url(), v.maxLength(2048)),
	}),
	v.object({ kind: v.literal("person"), email: emailSchema }),
	v.object({ kind: v.literal("team") }),
]);

export type CodeRecipients = v.InferOutput<typeof codeRecipientsSchema>;

export type NotificationCode = {
	code: string;
	/** What it is for, in its maker's words: "Deploy alerts". */
	label: string;
	to: CodeRecipients;
	createdAt: string;
	lastUsedAt: string | null;
};

export const createNotificationCodeInputSchema = v.object({
	code: notificationCodeSchema,
	label: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, "A name is required"),
		v.maxLength(60, "The name must be 60 characters or fewer"),
	),
	to: codeRecipientsSchema,
});

export type CreateNotificationCodeInput = v.InferOutput<
	typeof createNotificationCodeInputSchema
>;

export const deleteNotificationCodeInputSchema = v.object({
	code: notificationCodeSchema,
});

/** A link a notification opens: a page of the app, or anywhere on the web. */
const linkSchema = v.pipe(
	v.string(),
	v.trim(),
	v.maxLength(2048, "The link must be 2048 characters or fewer"),
	v.regex(
		/^(\/|https?:\/\/)/,
		"A link starts with / for a page of the app, or with http(s)://",
	),
);

/** What `/api/notify` is sent. */
export const notifyInputSchema = v.object({
	code: notificationCodeSchema,
	// Left out, it is empty: which the length check then names.
	title: v.optional(
		v.pipe(
			v.string("The title must be text"),
			v.trim(),
			v.minLength(1, "A title is required"),
			v.maxLength(100, "The title must be 100 characters or fewer"),
		),
		"",
	),
	body: v.optional(
		v.pipe(
			v.string(),
			v.trim(),
			v.maxLength(500, "The message must be 500 characters or fewer"),
		),
		"",
	),
	/** A picture shown large in the notification, where the device can. */
	image: v.optional(
		v.pipe(
			v.string(),
			v.trim(),
			v.maxLength(2048, "The image link must be 2048 characters or fewer"),
			v.regex(/^https?:\/\//, "An image link starts with http(s)://"),
		),
	),
	/** Where tapping it goes; Today when left out. */
	url: v.optional(linkSchema),
});

export type NotifyInput = v.InferOutput<typeof notifyInputSchema>;
