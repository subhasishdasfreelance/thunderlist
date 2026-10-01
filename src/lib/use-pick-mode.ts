import { useCallback, useState } from "react";

/** Nothing picked. One set, so starting twice draws nothing again. */
const NONE: ReadonlySet<string> = new Set();

/**
 * Picking things out of a screen of cards — checklists, trackers, tags, plans,
 * countdowns — to do something to all of them at once; see `Pickable` and
 * `PickedItemsBar`.
 *
 * The cards are links, and dragging over one drags the link rather than
 * selecting it, so tasks' way of picking does not reach them; see
 * `useTaskSelection`. Instead the screen is put into picking with Select,
 * where pressing a card picks it rather than opening it, until the bar over
 * them is closed.
 */
export function usePickMode(): {
	isPicking: boolean;
	picked: ReadonlySet<string>;
	start: () => void;
	stop: () => void;
	toggle: (id: string) => void;
} {
	const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);

	const start = useCallback(() => setPicked(new Set()), []);
	const stop = useCallback(() => setPicked(null), []);
	const toggle = useCallback(
		(id: string) =>
			setPicked((current) => {
				if (current === null) return null;
				const next = new Set(current);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return next;
			}),
		[],
	);

	return {
		isPicking: picked !== null,
		picked: picked ?? NONE,
		start,
		stop,
		toggle,
	};
}
