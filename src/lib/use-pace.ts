import type { PaceStatus } from "#/schemas/checklist";
import { elapsedFraction, type PaceInput, paceStatus } from "./progress";
import { useNow } from "./use-now";

export type Pace = {
	/** The minute it was worked out at, or `null` before the browser has one. */
	now: number | null;
	/**
	 * How much of the time has gone, 0-1. `null` when there is nothing to
	 * measure against; `undefined` while the browser has yet to read its clock,
	 * so the room for the mark can be kept rather than opening up afterwards.
	 */
	elapsed: number | null | undefined;
	/** "Ahead", "On track" or "Behind" — or `null` whenever it cannot be judged. */
	status: PaceStatus | null;
};

/**
 * Where something stands against its schedule at a given minute.
 *
 * `fractionComplete` is `null` for something with nothing in it yet, which has
 * no pace to judge; the mark is still drawn, because the time passes all the
 * same. `now` is `null` before the browser has the time; see `useNow`.
 */
export function paceAt(
	schedule: PaceInput,
	fractionComplete: number | null,
	now: number | null,
): Pace {
	if (now === null) {
		const isPaced = schedule.dailyWindow != null || schedule.deadline !== null;
		return { now, elapsed: isPaced ? undefined : null, status: null };
	}

	const input = { ...schedule, now };

	return {
		now,
		elapsed: elapsedFraction(input),
		status:
			fractionComplete === null
				? null
				: paceStatus({ ...input, fractionComplete }),
	};
}

/** `paceAt`, on the viewer's own clock. */
export function usePace(
	schedule: PaceInput,
	fractionComplete: number | null,
): Pace {
	return paceAt(schedule, fractionComplete, useNow());
}
