/**
 * Turning what happened into something that can be drawn.
 *
 * A chart wants cumulative readings on a timeline: at this moment, this much
 * had been done. Trackers already store exactly that. Tasks do not — they store
 * a tick and the moment it happened — so they are counted up here.
 */

import type { ChartPoint } from "#/components/common/progress-chart";
import type { Task } from "#/schemas/task";

/** Midnight at the start of a `YYYY-MM-DD` day, in the reader's own zone. */
export function dayStart(date: string): number {
	const [year, month, day] = date.split("-").map(Number);

	return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).getTime();
}

/**
 * The completions of a set of tasks, counted up over time.
 *
 * Tasks ticked before completion times were recorded have no moment to be
 * placed at, so they are counted as already done at `from` rather than being
 * dropped or invented a date. That keeps the line ending where the figures say
 * it should — at the true completed count — and is why an old checklist starts
 * its curve part-way up instead of at zero.
 */
export function completionPoints(
	tasks: ReadonlyArray<Task>,
	from: number,
): Array<ChartPoint> {
	const timed: Array<{ id: string; at: number }> = [];
	let untimed = 0;

	for (const task of tasks) {
		if (!task.completed) continue;

		const at = task.completedAt === null ? null : Date.parse(task.completedAt);
		if (at === null || Number.isNaN(at)) untimed += 1;
		else timed.push({ id: task.taskId, at });
	}

	timed.sort((a, b) => a.at - b.at);

	// The first point is the floor the timed ones count up from, so it is named
	// for what it is rather than for any one task.
	const points: Array<ChartPoint> = [{ id: "start", at: from, value: untimed }];
	let running = untimed;

	for (const task of timed) {
		running += 1;
		points.push({ id: task.id, at: Math.max(task.at, from), value: running });
	}

	return points;
}

/** A day in milliseconds, which is what Today is measured against. */
export const DAY_MS = 24 * 3_600_000;

/** Midnight at the start of today, in the reader's own zone. */
export function startOfDay(now: Date = new Date()): number {
	return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}
