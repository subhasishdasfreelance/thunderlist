/**
 * Who is signed in. Server only.
 *
 * Google is the only way in. There is no password to phish, reset or store,
 * and no sign-up form to defend — an account exists because Google says the
 * person behind it does.
 *
 * Better Auth keeps its own users, sessions and accounts in the same database
 * as everything else, under its own table names. Those are the "separate place
 * for users": nothing in `src/data` writes to them, and nothing here knows what
 * a checklist is. The only thing crossing between the two is a user id.
 */

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { authDatabase } from "#/lib/mongo/client.server";

if (typeof window !== "undefined") {
	throw new Error(
		"The auth configuration holds the client secret and must never reach the browser.",
	);
}

const { client, db } = await authDatabase();

function required(name: string): string {
	const value = (process.env[name] ?? "").trim();

	if (value === "") {
		throw new Error(
			`${name} is not set. Sign-in cannot work without it; see .env.example.`,
		);
	}

	return value;
}

const baseURL = required("BETTER_AUTH_URL");

/*
 * Say out loud which origin this process is configured for.
 *
 * `BETTER_AUTH_URL` is read once, when the process starts, and everything about
 * signing in is measured against it: the browser's `callbackURL` has to be on
 * that origin or the request is refused with a bare
 * `403 Invalid callbackURL`, and it is also the `redirect_uri` Google is given.
 *
 * So a server left running across an edit to `.env.local`, or started on a port
 * the env file does not name, fails with an error that says nothing about
 * ports. One line in the terminal turns that into something you can see.
 */
console.log(`[thunderlist] Sign-in is configured for ${baseURL}`);
console.log(
	"[thunderlist] Serve the app from that exact origin, port included.",
);

export const auth = betterAuth({
	database: mongodbAdapter(db, { client }),
	baseURL,
	secret: required("BETTER_AUTH_SECRET"),

	// No local passwords: the only credential is the Google account.
	emailAndPassword: { enabled: false },

	socialProviders: {
		google: {
			clientId: required("GOOGLE_CLIENT_ID"),
			clientSecret: required("GOOGLE_CLIENT_SECRET"),
		},
	},

	plugins: [tanstackStartCookies()],
});
