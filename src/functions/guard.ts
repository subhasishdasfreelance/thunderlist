import { AppError } from "#/lib/errors";

/**
 * Run a data-layer call and make sure only safe messages reach the browser.
 *
 * `AppError` messages are written for users and pass through. Anything else -
 * a driver error, a parse failure, a stack trace - is logged on the server and
 * replaced, so the connection string and internals never leave the process.
 */
export async function guard<T>(
	label: string,
	run: () => Promise<T>,
): Promise<T> {
	try {
		return await run();
	} catch (error) {
		if (error instanceof AppError) {
			console.error(`[thunderlist] ${label}: ${error.code} - ${error.message}`);
			throw new Error(error.message);
		}

		console.error(`[thunderlist] ${label} failed:`, error);
		throw new Error(
			"Something went wrong while talking to the database. Please try again.",
		);
	}
}
