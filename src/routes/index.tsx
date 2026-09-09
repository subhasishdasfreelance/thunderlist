import { createFileRoute, redirect } from "@tanstack/react-router";

/** Thunderlist opens straight into the app; there is no landing page. */
export const Route = createFileRoute("/")({
	beforeLoad: () => {
		// `/today` takes an optional `?task=`; the bare list is what is wanted here.
		throw redirect({ to: "/today", search: { task: undefined } });
	},
});
