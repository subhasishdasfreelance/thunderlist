import { compareBehind, lagFraction } from "#/lib/progress";
import type { ChecklistSummary } from "#/schemas/checklist";
import { type TagSummary, tagStartDate, tagStartTime } from "#/schemas/tag";
import type { TrackerSummary } from "#/schemas/tracker";

/*
 * Most behind first, for each kind of card; see `ListOrderMenu`. Each is the
 * same measure the pace label on the card is drawn from, so the order agrees
 * with what each card says about itself. Judged at `now`, the viewer's clock.
 */

/** Checklists, most behind first; see `compareBehind`. */
export function checklistsBehind(now: number) {
	const standing = (checklist: ChecklistSummary) => ({
		startDate: checklist.startDate,
		startTime: checklist.startTime,
		deadline: checklist.deadline,
		deadlineTime: checklist.deadlineTime,
		dailyWindow: checklist.dailyWindow,
		now,
		fractionComplete: checklist.progress.percent / 100,
	});
	return (a: ChecklistSummary, b: ChecklistSummary) =>
		compareBehind(standing(a), standing(b));
}

/** Trackers, worst first; see `lagFraction`. */
export function trackersBehind(now: number) {
	const lag = (tracker: TrackerSummary) =>
		lagFraction({
			startDate: tracker.startDate,
			startTime: tracker.startTime,
			deadline: tracker.deadline,
			deadlineTime: tracker.deadlineTime,
			now,
			fractionComplete: tracker.progress.percent / 100,
		});
	return (a: TrackerSummary, b: TrackerSummary) => lag(b) - lag(a);
}

/** Tags, most behind first; see `compareBehind`. */
export function tagsBehind(now: number) {
	const standing = (tag: TagSummary) => ({
		startDate: tagStartDate(tag),
		startTime: tagStartTime(tag),
		deadline: tag.deadline,
		deadlineTime: tag.deadlineTime,
		dailyWindow: tag.dailyWindow,
		now,
		fractionComplete: tag.progress.percent / 100,
	});
	return (a: TagSummary, b: TagSummary) =>
		compareBehind(standing(a), standing(b));
}
