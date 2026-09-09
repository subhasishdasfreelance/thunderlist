/**
 * How fast something is moving, and how fast it needs to.
 *
 * Shared by checklists and trackers: a checklist counts tasks and a tracker
 * counts pages, but "am I going fast enough to finish by the deadline" is the
 * same question and deserves the same answer.
 *
 * Each figure is `null` when there is not enough information to work it out:
 * no deadline, or a standstill that would never finish.
 */
export type Velocity = {
	/** Whole days from the start date to today. */
	daysElapsed: number;
	/** Whole days from today to the deadline. Negative once it has passed. */
	daysRemaining: number | null;
	/** The whole window, start date to deadline. */
	totalDays: number | null;
	/** Units covered per day so far. */
	perDay: number | null;
	/** Units per day the whole window asks for, start to deadline. */
	expectedPerDay: number | null;
	/** Units per day needed from today to still hit the deadline. */
	requiredPerDay: number | null;
	/** `YYYY-MM-DD` the target is reached if the current pace holds. */
	projectedFinish: string | null;
};
