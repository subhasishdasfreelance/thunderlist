import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { reportError } from "#/data/error-report.server";
import { notifyWithCode } from "#/data/notification-code.server";
import { AppError, type AppErrorCode } from "#/lib/errors";
import { notifyInputSchema } from "#/schemas/notification-code";

/**
 * Open to a browser on any site: the code is what keeps strangers out, not
 * where the request comes from. `Content-Type` is named because JSON is not
 * one of the kinds a browser sends without asking first.
 */
const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "POST, OPTIONS",
	"access-control-allow-headers": "Content-Type",
};

const STATUS: Record<AppErrorCode, number> = {
	invalid_data: 400,
	unauthorized: 403,
	not_found: 404,
	not_configured: 503,
	upstream_failed: 502,
};

function failure(error: string, status: number): Response {
	return Response.json({ error }, { status, headers: CORS_HEADERS });
}

/**
 * Sends a notification with a notification code; see `NotificationCode`.
 *
 * `POST` JSON: `{ code, title, body?, image?, url? }`. Answers
 * `{ people, devices }` — how many took it — or `{ error }` with a status
 * saying why not: 400 for what was sent, 403 for a team's code whose maker can
 * no longer message it, 404 for no such code.
 */
async function notify(request: Request): Promise<Response> {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return failure("Send JSON: { code, title, body, image, url }.", 400);
	}

	const parsed = v.safeParse(notifyInputSchema, raw);
	if (!parsed.success) return failure(parsed.issues[0].message, 400);

	try {
		const result = await notifyWithCode(parsed.output);
		return Response.json(result, { headers: CORS_HEADERS });
	} catch (error) {
		if (error instanceof AppError) {
			return failure(error.message, STATUS[error.code]);
		}
		console.error("[thunderlist] notify failed:", error);
		await reportError("notify", error);
		return failure("The notification could not be sent.", 500);
	}
}

export const Route = createFileRoute("/api/notify")({
	server: {
		handlers: {
			POST: ({ request }) => notify(request),
			// The browser's check before a cross-site request with JSON in it.
			OPTIONS: () => new Response(null, { status: 204, headers: CORS_HEADERS }),
		},
	},
});
