import { createServerFn } from "@tanstack/react-start";
import { getSearchIndex } from "#/data/search.server";
import { AppError } from "#/lib/errors";
import { collections, isConfigured } from "#/lib/mongo/client.server";
import { guard } from "./guard";

type SetupStatus = {
	isConfigured: boolean;
	/** Null until the database has been reached successfully. */
	connectionError: string | null;
};

/**
 * Whether the app can reach its database.
 *
 * Reports missing configuration without any network call, and otherwise proves
 * the connection by opening it, which is also when the indexes are created.
 */
export const getSetupStatusFn = createServerFn().handler(
	async (): Promise<SetupStatus> => {
		if (!isConfigured()) {
			return { isConfigured: false, connectionError: null };
		}

		try {
			await collections();
			return { isConfigured: true, connectionError: null };
		} catch (error) {
			const message =
				error instanceof AppError
					? error.message
					: "Could not open the database.";

			console.error("[thunderlist] Setup check failed:", error);

			return { isConfigured: true, connectionError: message };
		}
	},
);

export const getSearchIndexFn = createServerFn().handler(() =>
	guard("getSearchIndex", () => getSearchIndex()),
);
