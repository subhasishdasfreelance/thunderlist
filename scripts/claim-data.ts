/**
 * Give the rows that predate sign-in an owner.
 *
 * Every document now carries a `userId` and every query filters on it, so the
 * checklists, trackers and tasks that existed before accounts did belong to
 * nobody and are visible to nobody. This hands them to one account, once.
 *
 * It is a script you run on purpose rather than something the app does on its
 * own. "Adopt the unowned rows on first sign-in" would mean the first person
 * through the door inherits someone else's data, which is exactly the hole the
 * owner column exists to close.
 *
 *   bun run claim-data you@example.com
 *
 * Rows that already have an owner are never touched, so running it twice is
 * safe and running it after a second account exists cannot move anything.
 */

import { MongoClient } from "mongodb";

const COLLECTIONS = [
	"checklists",
	"tasks",
	"trackers",
	"entries",
	"taskRefs",
	"tags",
] as const;

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
	console.error("Usage: bun run claim-data <email>");
	console.error("The email of the Google account that should own the data.");
	process.exit(1);
}

const uri = (process.env.MONGO_CONN_STR ?? "").trim();

if (uri === "") {
	console.error("MONGO_CONN_STR is not set.");
	process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();

try {
	const db = client.db("thunderlist");

	// The account list is small and this runs once, so the email is compared in
	// JavaScript rather than as a regular expression built from user input.
	const accounts = await db.collection("user").find({}).toArray();
	const user = accounts.find(
		(candidate) => String(candidate.email ?? "").toLowerCase() === email,
	);

	if (!user) {
		console.error(`No account for ${email}.`);
		console.error("Sign in with Google once first, then run this again.");
		process.exit(1);
	}

	const userId = String(user._id);
	let claimed = 0;

	for (const name of COLLECTIONS) {
		const result = await db
			.collection(name)
			.updateMany({ userId: { $exists: false } }, { $set: { userId } });

		claimed += result.modifiedCount;
		console.log(`${name}: ${result.modifiedCount} claimed`);
	}

	console.log(`\n${claimed} rows now belong to ${email}.`);
} finally {
	await client.close();
}
