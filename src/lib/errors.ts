/**
 * Application errors.
 *
 * Everything thrown out of a server function reaches the browser, so the
 * message on an `AppError` must always be safe to show a user. Driver errors,
 * the connection string and stack traces stay on the server.
 */

const ERROR_CODES = [
	"not_configured",
	/** No session, or one that has expired. The answer is to sign in again. */
	"unauthorized",
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

/**
 * Whether asking again might get a different answer.
 *
 * An `AppError`'s code survives the trip to the browser; see `guard`. Most codes
 * are answers — that no longer exists, sign in, that is not allowed — which the
 * same request gets every time. `upstream_failed` is a hiccup, and so is
 * anything with no code at all: a dropped connection, a function that timed
 * out before it could answer.
 */
export function isTransient(error: unknown): boolean {
	const code =
		typeof error === "object" && error !== null && "code" in error
			? error.code
			: undefined;
	// A DOMException's `code` is a number, and says nothing about the server.
	return typeof code !== "string" || code === "upstream_failed";
}

/** Best-effort user-facing message for anything caught in a component. */
export function errorMessage(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	return "Something went wrong. Please try again.";
}
