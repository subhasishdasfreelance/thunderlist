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

export type ChecklistDoc = Checklist;
export type TrackerDoc = Tracker;
export type TagDoc = Tag;

export type TaskDoc = Task & { checklistId: string };

/**
 * `delta` is not stored: it is the step from the reading before it, which
 * changes whenever a neighbour is added, edited or back-dated. Deriving it on
 * read means there is nothing to keep in step. See `withDeltas`.
 */
export type EntryDoc = Omit<ProgressEntry, "delta"> & { trackerId: string };

export type TaskRefDoc = TaskRef & { list: TaskListName };

export type Collections = {
	checklists: Collection<ChecklistDoc>;
	tasks: Collection<TaskDoc>;
	trackers: Collection<TrackerDoc>;
	entries: Collection<EntryDoc>;
	taskRefs: Collection<TaskRefDoc>;
	tags: Collection<TagDoc>;
};

/** Strips Mongo's `_id`, leaving exactly the domain object. */
export const DOMAIN_FIELDS = { _id: 0 } as const;

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
 * The rest are the lookups every screen makes: a checklist's tasks, a tracker's
 * history, and one of the two reference lists in order.
 */
async function ensureIndexes(current: Collections): Promise<void> {
	await Promise.all([
		current.checklists.createIndex({ checklistId: 1 }, { unique: true }),
		current.trackers.createIndex({ trackerId: 1 }, { unique: true }),
		current.tags.createIndex({ tagId: 1 }, { unique: true }),
		current.tasks.createIndex({ taskId: 1 }, { unique: true }),
		current.tasks.createIndex({ checklistId: 1 }),
		current.entries.createIndex({ entryId: 1 }, { unique: true }),
		current.entries.createIndex({ trackerId: 1, recordedAt: 1 }),
		current.taskRefs.createIndex({ itemId: 1 }, { unique: true }),
		current.taskRefs.createIndex({ list: 1, sortOrder: 1 }),
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

async function connect(): Promise<Collections> {
	const client = new MongoClient(requireConnectionString());

	try {
		await client.connect();
	} catch (error) {
		console.error("[thunderlist] Could not connect to MongoDB:", error);
		throw describeConnectFailure(error);
	}

	const current = collectionsOf(client.db(DB_NAME));
	await ensureIndexes(current);
	return current;
}

export function collections(): Promise<Collections> {
	if (connection) return connection;

	connection = connect().catch((error: unknown) => {
		connection = null;
		throw error;
	});

	return connection;
}
