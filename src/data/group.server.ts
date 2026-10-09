/**
 * A group's work over time, for its chart. Server only.
 *
 * The figures on its card and page are added up in the browser from what the
 * checklists, tags and trackers screens already hold; see `useGroupContents`.
 * When each of those things was finished is not held anywhere, so it is read
 * here, in a few queries however many checklists the group holds.
 */

import { AppError } from "#/lib/errors";
import { collections } from "#/lib/mongo/client.server";
import { reachedTargetOn, trackerProgress } from "#/lib/progress";
import type { Task } from "#/schemas/task";
import { withTrackedCompletion } from "./checklist.server";
import { listGroups } from "./settings.server";
import { type Hidden, isTaskVisible } from "./visibility.server";

/** One thing a group counts, and when it was finished; see `completionPoints`. */
export type GroupFinish = Pick<Task, "taskId" | "completed" | "completedAt">;

const TASK_PROJECTION = {
	_id: 0,
	taskId: 1,
	checklistId: 1,
	tagIds: 1,
	completed: 1,
	completedAt: 1,
	trackerId: 1,
	linkedChecklistId: 1,
} as const;

/**
 * Everything a group counts, counted the way `useGroupContents` counts it: a
 * task once for its checklist and once more for each of the group's tags it
 * carries, and a tracker once for the group and once for each of its tags —
 * so the chart climbs to the same figure the bar shows.
 */
export async function getGroupFinished(
	userId: string,
	groupId: string,
	hidden: Hidden,
): Promise<Array<GroupFinish>> {
	const group = (await listGroups(userId)).find(
		(each) => each.groupId === groupId,
	);
	if (group === undefined) {
		throw new AppError("not_found", "That group no longer exists.");
	}

	const idsOf = (kind: string, kept: ReadonlySet<string>) =>
		group.items.flatMap((item) =>
			item.kind === kind && !kept.has(item.id) ? [item.id] : [],
		);
	const checklistIds = idsOf("checklist", hidden.checklistIds);
	const tagIds = idsOf("tag", hidden.tagIds);
	const trackerIds = idsOf("tracker", hidden.trackerIds);

	const current = await collections();
	const [inLists, tagged, trackers] = await Promise.all([
		checklistIds.length === 0
			? []
			: current.tasks
					.find(
						{ userId, checklistId: { $in: checklistIds } },
						{ projection: TASK_PROJECTION },
					)
					.toArray(),
		tagIds.length === 0
			? []
			: current.tasks
					.find(
						{ userId, tagIds: { $in: tagIds } },
						{ projection: TASK_PROJECTION },
					)
					.toArray(),
		trackerIds.length === 0 && tagIds.length === 0
			? []
			: current.trackers
					.find(
						{
							userId,
							$or: [
								{ trackerId: { $in: trackerIds } },
								{ tagIds: { $in: tagIds } },
							],
						},
						{
							projection: {
								_id: 0,
								trackerId: 1,
								tagIds: 1,
								currentValue: 1,
								targetValue: 1,
								startValue: 1,
							},
						},
					)
					.toArray(),
	]);

	// Finished by a tracker or another checklist counts as finished, as it
	// does on the checklist's own screen; see `withTrackedCompletion`.
	const visibleInLists = inLists.filter((task) => isTaskVisible(task, hidden));
	const visibleTagged = tagged.filter((task) => isTaskVisible(task, hidden));
	const isDone = new Map(
		(
			await withTrackedCompletion(current, userId, [
				...visibleInLists,
				...visibleTagged,
			])
		).map((task) => [task.taskId, task.completed]),
	);
	const finish = (
		task: (typeof inLists)[number],
		taskId: string,
	): GroupFinish => ({
		taskId,
		completed: isDone.get(task.taskId) ?? task.completed,
		completedAt: task.completedAt,
	});

	const finishes = visibleInLists.map((task) => finish(task, task.taskId));
	for (const task of visibleTagged) {
		for (const tagId of task.tagIds) {
			if (tagIds.includes(tagId)) {
				finishes.push(finish(task, `${task.taskId}:${tagId}`));
			}
		}
	}

	const shown = trackers.filter(
		(tracker) => !hidden.trackerIds.has(tracker.trackerId),
	);
	if (shown.length === 0) return finishes;

	const readings = await current.entries
		.find(
			{
				userId,
				trackerId: { $in: shown.map((tracker) => tracker.trackerId) },
			},
			{
				projection: {
					_id: 0,
					trackerId: 1,
					value: 1,
					recordedAt: 1,
					recordedTime: 1,
				},
			},
		)
		.toArray();

	for (const tracker of shown) {
		const isReached =
			trackerProgress(
				tracker.currentValue,
				tracker.targetValue,
				tracker.startValue,
			).percent >= 100;
		const doneOn = isReached
			? reachedTargetOn(
					readings.filter((each) => each.trackerId === tracker.trackerId),
					tracker.targetValue,
					tracker.startValue,
				)
			: null;
		const counts = [
			...(trackerIds.includes(tracker.trackerId) ? ["group"] : []),
			...(tracker.tagIds ?? []).filter((tagId) => tagIds.includes(tagId)),
		];
		for (const under of counts) {
			finishes.push({
				taskId: `${tracker.trackerId}:${under}`,
				completed: isReached,
				completedAt: doneOn,
			});
		}
	}

	return finishes;
}
