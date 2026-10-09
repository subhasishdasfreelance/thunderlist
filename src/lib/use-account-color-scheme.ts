import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { setColorSchemeFn } from "#/functions/preferences.functions";
import { errorMessage } from "#/lib/errors";
import { type ColorScheme, setColorScheme } from "#/lib/theme";
import { useToast } from "#/lib/toasts";
import { queryKeys } from "#/queries/keys";
import { colorSchemeQuery } from "#/queries/preferences";

type Kept = ColorScheme | null;

/**
 * Light or dark follows the person to every device: picked on one, it is kept
 * on the account, and every other device signed in to it switches to it when
 * it next opens the app or comes back to it.
 *
 * The device's own copy still draws the page first, so nothing waits on a
 * fetch; the account's copy is drawn as soon as it arrives. An account that
 * never kept one takes this device's choice.
 *
 * Returns how to pick one; signed out, it is kept on this device only.
 */
export function useAccountColorScheme(
	scheme: ColorScheme,
	isSignedIn: boolean,
): (scheme: ColorScheme) => void {
	const queryClient = useQueryClient();
	const toast = useToast();
	const kept = useQuery({ ...colorSchemeQuery(), enabled: isSignedIn }).data;

	const { mutate: keep } = useMutation({
		mutationFn: (next: ColorScheme) =>
			setColorSchemeFn({ data: { colorScheme: next } }),
		// Drawn at once. A fetch already on its way back is cancelled first, or
		// its older answer would land on top and switch the scheme back.
		onMutate: async (next) => {
			await queryClient.cancelQueries({ queryKey: queryKeys.colorScheme });
			const previous = queryClient.getQueryData<Kept>(queryKeys.colorScheme);
			queryClient.setQueryData<Kept>(queryKeys.colorScheme, next);
			return { previous };
		},
		onError: (error, _next, context) => {
			queryClient.setQueryData<Kept>(
				queryKeys.colorScheme,
				context?.previous ?? null,
			);
			toast({ body: errorMessage(error), type: "error", uniqueID: "theme" });
		},
	});

	// Whatever the account holds is drawn here: picked here, or on another device.
	useEffect(() => {
		if (kept != null) setColorScheme(kept);
	}, [kept]);

	// An account that never kept one takes this device's. Quietly: should it
	// fail, it is tried again the next time the account's copy is fetched.
	useEffect(() => {
		if (kept !== null || scheme === "system") return;
		setColorSchemeFn({ data: { colorScheme: scheme } })
			.then(() => queryClient.setQueryData<Kept>(queryKeys.colorScheme, scheme))
			.catch(() => {});
	}, [kept, scheme, queryClient]);

	return (next) => {
		setColorScheme(next);
		if (isSignedIn) keep(next);
	};
}
