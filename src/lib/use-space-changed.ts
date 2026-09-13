import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * Catch up with a change of space: into a team, out of one — leaving it, or it
 * being deleted — or back to your own.
 *
 * Every cached read belongs to the space just left, so all of it is thrown
 * away — with the installed app's kept copy of Today, which is that space's
 * too, as on signing out — and the app opens on the new space's Today.
 * Whatever was open, a checklist say, belongs to the old space and would not be
 * found in the new.
 *
 * Reset, not cleared. Clearing the cache drops the queries out from under the
 * screen already showing them: it keeps drawing the old lists and never asks
 * again — which is what leaving a team from Today looked like. A reset empties
 * each one in place, so everything on screen shows its loading state and
 * reads afresh.
 */
export function useSpaceChanged(): () => Promise<void> {
	const queryClient = useQueryClient();
	const router = useRouter();

	return useCallback(async () => {
		await queryClient.cancelQueries();
		if ("caches" in window) void caches.delete("thunderlist-pages-v1");

		const reset = queryClient.resetQueries();
		await router.navigate({
			to: "/tags/$tagId",
			params: { tagId: "today" },
			search: { task: undefined },
		});
		await router.invalidate();
		await reset;
	}, [queryClient, router]);
}
