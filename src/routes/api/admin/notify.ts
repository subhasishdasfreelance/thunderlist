import { createHash, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { reportError } from "#/data/error-report.server";
import { notifyAsAdmin } from "#/data/notification-code.server";
import { AppError, type AppErrorCode } from "#/lib/errors";
import { adminNotifyInputSchema } from "#/schemas/notification-code";

const STATUS: Record<AppErrorCode, number> = {
	invalid_data: 400,
	unauthorized: 403,
	not_found: 404,
	not_configured: 503,
	upstream_failed: 502,
};

function failure(error: string, status: number): Response {
	return Response.json({ error }, { status });
}

/**
 * Whether `Authorization: Bearer …` carries `ADMIN_TOKEN`. Both are hashed
 * first so they compare in the same time whatever their lengths, giving
 * nothing away about how much of a guess was right.
 */
function isAdmin(request: Request, token: string): boolean {
	const sent = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
	if (!sent) return false;
	const hash = (text: string) => createHash("sha256").update(text).digest();
	return timingSafeEqual(hash(sent.trim()), hash(token));
}

/**
 * Sends a notification to one person, as the app's admin.
 *
 * Off unless `ADMIN_TOKEN` is set in the environment, and then open only to a
 * request carrying it as `Authorization: Bearer <token>`. Meant for scripts on
 * a server, so no other site may call it from a browser.
 *
 * `POST` JSON: `{ email, title, body?, image?, url? }`. Answers
 * `{ people, devices }` — how many took it — or `{ error }` with a status
 * saying why not: 400 for what was sent, 401 for a missing or wrong token,
 * 503 when no admin token or no push keys are set.
 */
async function notify(request: Request): Promise<Response> {
	const token = process.env.ADMIN_TOKEN?.trim() ?? "";
	if (!token) {
		return failure("Admin notifications are not set up on this server.", 503);
	}
	if (!isAdmin(request, token)) {
		return failure(
			"Send the admin token as Authorization: Bearer <token>.",
			401,
		);
	}

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return failure("Send JSON: { email, title, body, image, url }.", 400);
	}

	const parsed = v.safeParse(adminNotifyInputSchema, raw);
	if (!parsed.success) return failure(parsed.issues[0].message, 400);

	try {
		return Response.json(await notifyAsAdmin(parsed.output));
	} catch (error) {
		if (error instanceof AppError) {
			return failure(error.message, STATUS[error.code]);
		}
		console.error("[thunderlist] admin notify failed:", error);
		await reportError("admin-notify", error);
		return failure("The notification could not be sent.", 500);
	}
}

export const Route = createFileRoute("/api/admin/notify")({
	server: {
		handlers: {
			POST: ({ request }) => notify(request),
		},
	},
});
