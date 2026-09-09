/**
 * Application errors.
 *
 * Everything thrown out of a server function reaches the browser, so the
 * message on an `AppError` must always be safe to show a user. Driver errors,
 * the connection string and stack traces stay on the server.
 */

const ERROR_CODES = [
	"not_configured",
	"not_found",
	"invalid_data",
	"upstream_failed",
] as const;

export type AppErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
	readonly code: AppErrorCode;

	constructor(code: AppErrorCode, message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "AppError";
		this.code = code;
	}
}

/** Best-effort user-facing message for anything caught in a component. */
export function errorMessage(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	return "Something went wrong. Please try again.";
}
