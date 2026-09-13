/**
 * How fast something is moving, and how fast it needs to.
 *
 * Shared by checklists and trackers: a checklist counts tasks and a tracker
 * counts pages, but "am I going fast enough to finish by the deadline" is the
 * same question and deserves the same answer.
 *
 * Every figure is measured to the minute and every speed is given per day; see
 * `computeVelocity`. Each is `null` when there is not enough information to
 * work it out: no deadline, or a standstill that would never finish.
 */
export type Velocity = {
	/** Minutes from the start of the start date to now. */
	minutesElapsed: number;
	/** Minutes from now to the deadline. Negative once it has passed. */
	minutesRemaining: number | null;
	/** The whole window, start to deadline, in minutes. */
	totalMinutes: number | null;
	/** Units covered per day so far. `null` in the first quarter hour. */
	perDay: number | null;
	/** Units per day the whole window asks for, start to deadline. */
	expectedPerDay: number | null;
	/** Units per day needed from now to still hit the deadline. */
	requiredPerDay: number | null;
	/** `YYYY-MM-DD` the target is reached if the current pace holds. */
	projectedFinish: string | null;
};
