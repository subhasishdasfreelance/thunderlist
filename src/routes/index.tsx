import { createFileRoute, redirect } from "@tanstack/react-router";

/** Thunderlist opens straight into the app; there is no landing page. */
export const Route = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({ to: "/today" });
	},
});
