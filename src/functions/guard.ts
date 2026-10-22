import { reportError } from "#/data/error-report.server";
import { AppError } from "#/lib/errors";

/**
 * Run a data-layer call and make sure only safe messages reach the browser.
 *
 * `AppError` messages are written for users and pass through, with their code
 * so the browser can tell an answer from a hiccup; see `isTransient`. They are
 * thrown afresh, without the `cause` that could carry a driver error. Anything
 * else - a driver error, a parse failure, a stack trace - is logged on the
 * server and replaced, so the connection string and internals never leave the
 * process. It is reported too; see `reportError`.
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
			throw new AppError(error.code, error.message);
		}

		console.error(`[thunderlist] ${label} failed:`, error);
		await reportError(label, error);
		throw new AppError(
			"upstream_failed",
			"Something went wrong while talking to the database. Please try again.",
		);
	}
}
