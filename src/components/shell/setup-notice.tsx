import { Banner } from "@astryxdesign/core/Banner";
import { useQuery } from "@tanstack/react-query";
import { setupStatusQuery } from "#/queries/system";

/**
 * Connection state for the database.
 *
 * Silent once everything works: the app says something here only when it cannot
 * reach MongoDB and the user has to act.
 */
export function SetupNotice() {
	const { data } = useQuery(setupStatusQuery());

	if (!data) return null;

	if (!data.isConfigured) {
		return (
			<Banner
				status="warning"
				title="Connect a database"
				description="Thunderlist stores everything in MongoDB. Set MONGO_CONN_STR in your .env.local and restart the dev server."
				collapsible={false}
			/>
		);
	}

	if (data.connectionError !== null) {
		return (
			<Banner
				status="error"
				title="Cannot reach the database"
				description={data.connectionError}
				collapsible={false}
			/>
		);
	}

	return null;
}
