import { createHash, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import * as v from "valibot";
import { reportError } from "#/data/error-report.server";
import { notifyAsAdmin } from "#/data/notification-code.server";
import { AppError, type AppErrorCode } from "#/lib/errors";
import { adminNotifyInputSchema } from "#/schemas/notification-code";

/**
 * Open to a browser on any site: the admin token is what keeps strangers out,
 * not where the request comes from. `Authorization` and `Content-Type` are
 * named because a browser asks before sending either cross-site.
 */
const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "POST, OPTIONS",
	"access-control-allow-headers": "Authorization, Content-Type",
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
 * request carrying it as `Authorization: Bearer <token>`, from a script or from
 * a browser on any site.
 *
 * `POST` JSON: `{ email, title, body?, image?, url? }`. Answers
 * who it reached, on which devices, and who it missed — see `SendReport` — or
 * `{ error }` with a status saying why not: 400 for what was sent, 401 for a
 * missing or wrong token, 404 for no one with that email, 503 when no admin
 * token or no push keys are set.
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
		const result = await notifyAsAdmin(parsed.output);
		return Response.json(result, { headers: CORS_HEADERS });
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
			// The browser's check before a cross-site request with a token in it.
			OPTIONS: () => new Response(null, { status: 204, headers: CORS_HEADERS }),
		},
	},
});
