import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import {
	ErrorComponent,
	type ErrorComponentProps,
} from "@tanstack/react-router";
import { RotateCw } from "lucide-react";
import { useEffect } from "react";
import { isChunkLoadError, reloadForCurrentVersion } from "#/lib/chunk-reload";

/**
 * What a screen shows when it fails to load.
 *
 * A screen whose code could not be fetched is not an error to show anyone: the
 * page is reloaded for the current version straight away; see
 * `reloadForCurrentVersion`. Only if that was just tried — or the device is
 * offline — does it say so, with a way to try again. Anything else is the
 * router's own error, as before.
 */
export function RouteError({ error }: ErrorComponentProps) {
	if (!isChunkLoadError(error)) return <ErrorComponent error={error} />;
	return <ScreenNotLoaded />;
}

function ScreenNotLoaded() {
	useEffect(() => {
		reloadForCurrentVersion();
	}, []);

	return (
		<Banner
			status="info"
			title="This screen did not load"
			description="Thunderlist may have been updated since this page was opened. Reload to get the latest version."
			collapsible={false}
			endContent={
				<Button
					label="Reload"
					icon={<RotateCw aria-hidden />}
					size="sm"
					onClick={() => window.location.reload()}
				/>
			}
		/>
	);
}
