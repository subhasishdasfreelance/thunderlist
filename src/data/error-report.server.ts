/**
 * Errors nobody planned for, sent to whoever runs Thunderlist. Server only.
 *
 * Every catch on the server that meets something other than an `AppError` —
 * a server function, a saved change, an API route, an upload — hands it here,
 * and it is pushed to every device that address turned notifications on for.
 * An `AppError` is a refusal written for the person who caused it, not a
 * fault, so none of those come here.
 *
 * The same error from the same place is sent at most once every ten minutes
 * per server instance, so one broken thing does not become a hundred
 * notifications. Reporting never throws: a report that cannot be sent is
 * logged, and the error it was about carries on as it would have.
 */

import { sendTo } from "./reminder.server";

/** Who hears about errors, on every device they turned notifications on for. */
const REPORT_TO = "subhasishdasfreelance@gmail.com";

/** How long the same error stays quiet after it has been sent. */
const QUIET_FOR_MS = 10 * 60 * 1000;

/** When each error, by where and what, was last sent. */
const lastSent = new Map<string, number>();

export async function reportError(
	where: string,
	error: unknown,
): Promise<void> {
	const what =
		error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	const key = `${where}\n${what}`;
	const now = Date.now();
	if (now - (lastSent.get(key) ?? 0) < QUIET_FOR_MS) return;
	lastSent.set(key, now);

	try {
		await sendTo(
			{ email: REPORT_TO },
			{
				title: `Thunderlist error: ${where}`,
				body: what.slice(0, 300),
				url: "/tags/today",
			},
		);
	} catch (sendError) {
		console.error("[thunderlist] error report failed:", sendError);
	}
}
