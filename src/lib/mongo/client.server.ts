/**
 * The MongoDB connection and the collections Thunderlist stores. Server only.
 *
 * Documents are the domain objects as-is: a task document is a `Task` plus the
 * checklist it belongs to. Mongo's own `_id` is never used as an identity —
 * ids are minted in the browser so a queued change can be shown, referred to by
 * a later change and replayed on the server without ever being renumbered — so
 * every read projects `_id` away and hands back the domain shape directly.
 */

import {
	type Collection,
	type Db,
	MongoClient,
	MongoParseError,
	MongoServerError,
	MongoServerSelectionError,
} from "mongodb";
import { AppError } from "#/lib/errors";
import type { Checklist } from "#/schemas/checklist";
import type { Tag } from "#/schemas/tag";
import type { Task } from "#/schemas/task";
import type { TaskListName, TaskRef } from "#/schemas/task-list";
import type { ProgressEntry, Tracker } from "#/schemas/tracker";

if (typeof window !== "undefined") {
	throw new Error(
		"The database connection must never reach the browser. Import Mongo modules only from server functions.",
	);
}

/**
 * The connection string names no database, and the one it might name is not
 * necessarily the one this app owns, so the database is fixed here.
 */
const DB_NAME = "thunderlist";

/**
 * Who a row belongs to.
 *
 * Every document in every collection carries this, and every query — read and
 * write alike — filters on it. Ids are minted in the browser, so they are
 * guessable by anyone who cares to try; the owner is not, because it never
 * comes from the browser at all. It is read from the session on the server and
 * threaded down as the first argument of every function in `src/data`, which
 * makes leaving it out a type error rather than a leak.
 */
export type Owned = { userId: string };

export type ChecklistDoc = Checklist & Owned;
export type TrackerDoc = Tracker & Owned;
export type TagDoc = Tag & Owned;

/** `checklistId` is null for a task that belongs to no checklist. */
export type TaskDoc = Task & Owned & { checklistId: string | null };

/**
 * `delta` is not stored: it is the step from the reading before it, which
 * changes whenever a neighbour is added, edited or back-dated. Deriving it on
 * read means there is nothing to keep in step. See `withDeltas`.
 */
export type EntryDoc = Omit<ProgressEntry, "delta"> &
	Owned & {
		trackerId: string;
	};

export type TaskRefDoc = TaskRef & Owned & { list: TaskListName };

export type Collections = {
	checklists: Collection<ChecklistDoc>;
	tasks: Collection<TaskDoc>;
	trackers: Collection<TrackerDoc>;
	entries: Collection<EntryDoc>;
	taskRefs: Collection<TaskRefDoc>;
	tags: Collection<TagDoc>;
};

/**
 * Strips Mongo's `_id` and the owner, leaving exactly the domain object.
 *
 * `userId` is projected away for the same reason `_id` is: it is how the row is
 * stored, not part of what a checklist or a task *is*, and nothing on the
 * client has any business knowing it.
 */
export const DOMAIN_FIELDS = { _id: 0, userId: 0 } as const;

function readConnectionString(): string {
	return (process.env.MONGO_CONN_STR ?? "")
		.trim()
		.replace(/^["']|["']$/g, "")
		.trim();
}

export function isConfigured(): boolean {
	return readConnectionString() !== "";
}

function requireConnectionString(): string {
	const value = readConnectionString();
	if (value) return value;

	throw new AppError(
		"not_configured",
		"Thunderlist is not connected to a database yet. Set MONGO_CONN_STR and restart the server.",
	);
}

function collectionsOf(database: Db): Collections {
	return {
		checklists: database.collection<ChecklistDoc>("checklists"),
		tasks: database.collection<TaskDoc>("tasks"),
		trackers: database.collection<TrackerDoc>("trackers"),
		entries: database.collection<EntryDoc>("entries"),
		taskRefs: database.collection<TaskRefDoc>("taskRefs"),
		tags: database.collection<TagDoc>("tags"),
	};
}

/**
 * Ids are the app's own, so each is enforced unique here rather than trusted.
 *
 * They stay globally unique rather than unique per user: an id is minted in a
 * browser and a collision would be a bug wherever it happened, and a unique
 * index is the cheapest place to find out. Every other index leads with
 * `userId`, because so does every query.
 */
async function ensureIndexes(current: Collections): Promise<void> {
	await Promise.all([
		current.checklists.createIndex({ checklistId: 1 }, { unique: true }),
		current.checklists.createIndex({ userId: 1 }),
		current.trackers.createIndex({ trackerId: 1 }, { unique: true }),
		current.trackers.createIndex({ userId: 1 }),
		current.tags.createIndex({ tagId: 1 }, { unique: true }),
		current.tags.createIndex({ userId: 1 }),
		current.tasks.createIndex({ taskId: 1 }, { unique: true }),
		current.tasks.createIndex({ userId: 1, checklistId: 1 }),
		current.entries.createIndex({ entryId: 1 }, { unique: true }),
		current.entries.createIndex({ userId: 1, trackerId: 1, recordedAt: 1 }),
		current.taskRefs.createIndex({ itemId: 1 }, { unique: true }),
		current.taskRefs.createIndex({ userId: 1, taskId: 1 }),
		current.taskRefs.createIndex({ userId: 1, list: 1, sortOrder: 1 }),
	]);
}

/**
 * One connection per server instance, opened on first use.
 *
 * The driver holds its own pool and reconnects on its own, so the promise is
 * cached rather than the client: a failed first connection clears it, and the
 * next request tries again instead of inheriting the failure forever.
 */
let connection: Promise<Collections> | null = null;

/** Atlas reports a rejected user or password as 8000; everything else uses 18. */
const AUTH_FAILED_CODES = new Set([18, 8000]);

/**
 * Say which part of the connection is wrong.
 *
 * "Could not reach the database" and "the database rejected your password" are
 * different problems with different fixes, and one message covering both sends
 * the user to check the wrong thing. The driver's own text is never passed on:
 * it can quote the connection string, password and all.
 */
function describeConnectFailure(error: unknown): AppError {
	if (error instanceof MongoParseError) {
		return new AppError(
			"not_configured",
			"MONGO_CONN_STR is not a valid MongoDB connection string.",
		);
	}

	// `code` is typed loosely by the driver, so it is normalised before matching.
	if (
		error instanceof MongoServerError &&
		AUTH_FAILED_CODES.has(Number(error.code))
	) {
		return new AppError(
			"not_configured",
			"The database rejected those credentials. Check the username and password in MONGO_CONN_STR.",
		);
	}

	if (error instanceof MongoServerSelectionError) {
		return new AppError(
			"upstream_failed",
			"Could not reach the database. Check the host in MONGO_CONN_STR and that this machine is allowed to connect.",
		);
	}

	return new AppError("upstream_failed", "Could not open the database.");
}

async function openClient(): Promise<MongoClient> {
	const client = new MongoClient(requireConnectionString());

	try {
		await client.connect();
	} catch (error) {
		console.error("[thunderlist] Could not connect to MongoDB:", error);
		throw describeConnectFailure(error);
	}

	return client;
}

async function connect(): Promise<Collections> {
	const client = await openClient();
	const current = collectionsOf(client.db(DB_NAME));

	await ensureIndexes(current);

	return current;
}

/**
 * The raw database, for Better Auth's own tables.
 *
 * Accounts, sessions and users are Better Auth's to shape, so it is handed the
 * database rather than a set of collections defined here. They live alongside
 * the app's data in the same `thunderlist` database — one connection, one
 * place to back up — under Better Auth's own names, which do not collide with
 * any of the collections above.
 *
 * Opened separately and eagerly, because Better Auth wants a database at the
 * moment it is configured rather than a promise of one.
 */
let authConnection: Promise<{ client: MongoClient; db: Db }> | null = null;

export function authDatabase(): Promise<{ client: MongoClient; db: Db }> {
	if (authConnection) return authConnection;

	authConnection = openClient()
		.then((client) => ({ client, db: client.db(DB_NAME) }))
		.catch((error: unknown) => {
			authConnection = null;
			throw error;
		});

	return authConnection;
}

export function collections(): Promise<Collections> {
	if (connection) return connection;

	connection = connect().catch((error: unknown) => {
		connection = null;
		throw error;
	});

	return connection;
}
