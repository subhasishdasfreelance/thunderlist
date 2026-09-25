import { createFileRoute } from "@tanstack/react-router";
import { sendDueReminders } from "#/data/reminder.server";

/**
 * Sends the reminders that are due; see `sendDueReminders`.
 *
 * Nothing in the app calls this. A scheduler does, every five minutes or so
 * — a cron job on the host, or any service that can make a timed request —
 * with `Authorization: Bearer <CRON_SECRET>`. Without the secret set, or with
 * the wrong one, it does nothing, so a stranger cannot make it send.
 */
async function run(request: Request): Promise<Response> {
	const secret = process.env.CRON_SECRET?.trim() ?? "";
	const given = request.headers.get("authorization") ?? "";

	if (secret === "" || given !== `Bearer ${secret}`) {
		return new Response("Not allowed.", { status: 401 });
	}

	try {
		const result = await sendDueReminders(new Date());
		return Response.json(result);
	} catch (error) {
		console.error("[thunderlist] reminders failed:", error);
		return new Response("Reminders could not be sent.", { status: 500 });
	}
}

export const Route = createFileRoute("/api/reminders")({
	server: {
		handlers: {
			GET: ({ request }) => run(request),
			POST: ({ request }) => run(request),
		},
	},
});
