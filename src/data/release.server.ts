/**
 * Telling everyone about a new version. Server only.
 *
 * A release — a production build from `main` — announces itself the first
 * time it is asked which build it is; see `/api/version`, which every open page
 * asks every few minutes, and as it opens. Whichever request claims the
 * release in the database first sends one notification to every device anyone
 * turned notifications on for, with a Refresh button; every other request,
 * on this instance or another, finds it claimed and sends nothing.
 *
 * The claim only ever moves forward: an older build still answering somewhere
 * cannot announce itself over a newer one.
 */

import { collections } from "#/lib/mongo/client.server";
import { BUILD_ID, BUILT_AT, IS_RELEASE } from "#/lib/version";
import { reportError } from "./error-report.server";
import { sendToEveryone } from "./reminder.server";

/** A new version is news for a day; after that, opening the app shows it. */
const RELEASE_TTL = 60 * 60 * 24;

/** Once this instance has tried, it does not ask again. */
let isAnnounced = false;

/** Whether a Mongo error is a write refused for a duplicate key. */
function isDuplicate(error: unknown): boolean {
	return (error as { code?: number }).code === 11000;
}

export async function announceRelease(): Promise<void> {
	if (!IS_RELEASE || isAnnounced) return;
	isAnnounced = true;

	try {
		const current = await collections();
		let isClaimed: boolean;
		try {
			const claim = await current.releases.updateOne(
				{ _id: "latest", builtAt: { $lt: BUILT_AT } },
				{
					$set: {
						buildId: BUILD_ID,
						builtAt: BUILT_AT,
						announcedAt: new Date().toISOString(),
					},
				},
				{ upsert: true },
			);
			isClaimed = claim.modifiedCount + claim.upsertedCount > 0;
		} catch (error) {
			// Already there and as new or newer: someone else announced it.
			if (!isDuplicate(error)) throw error;
			isClaimed = false;
		}
		if (!isClaimed) return;

		const devices = await sendToEveryone(
			{
				title: "Thunderlist has been updated",
				body: "A new version is ready. Refresh to start using it.",
				url: "/tags/today",
				kind: "release",
			},
			RELEASE_TTL,
		);
		console.log(`[thunderlist] release ${BUILD_ID} sent to ${devices} devices`);
	} catch (error) {
		// Asked again on the next request.
		isAnnounced = false;
		console.error("[thunderlist] announcing the release failed:", error);
		await reportError("announcing the release", error);
	}
}
