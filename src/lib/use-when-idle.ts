import { useEffect, useState } from "react";

/**
 * Whether the screen has settled: `true` once `isReady` has held and the
 * browser has then had a moment with nothing else to do. It stays `true`.
 *
 * For reads nobody is waiting on — the finished tasks under a list — which
 * should go out after everything on screen has arrived rather than compete
 * with it. A browser without `requestIdleCallback` gets a short timer instead.
 */
export function useWhenIdle(isReady: boolean): boolean {
	const [isIdle, setIsIdle] = useState(false);

	useEffect(() => {
		if (!isReady || isIdle) return;

		if (typeof window.requestIdleCallback === "function") {
			const handle = window.requestIdleCallback(() => setIsIdle(true), {
				timeout: 2000,
			});
			return () => window.cancelIdleCallback(handle);
		}

		const timer = window.setTimeout(() => setIsIdle(true), 300);
		return () => window.clearTimeout(timer);
	}, [isReady, isIdle]);

	return isIdle;
}
