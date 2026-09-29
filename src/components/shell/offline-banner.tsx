import { Banner } from "@astryxdesign/core/Banner";

/**
 * Said above the page while there is no connection; see `useIsOnline`.
 *
 * The page stays as it was — whatever was being read, and anything half
 * typed — rather than being swapped for a screen of its own, and it goes away
 * on its own once the connection is back. Changes are refused meanwhile, so
 * none is drawn as made only to fail; see `useApplyChange`.
 */
export function OfflineBanner() {
	return (
		<Banner
			status="warning"
			title="You’re offline"
			description="You can still read what’s here. Changes can be made again once you’re back online."
			collapsible={false}
		/>
	);
}
