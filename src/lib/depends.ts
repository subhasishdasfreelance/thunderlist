/**
 * What a task waits on, judged from what this browser holds; see
 * `Task.dependsOn`.
 *
 * A task is not finished before everything it waits on is. That is checked
 * here, before a change is drawn, so a tick that is not allowed never lands on
 * screen only to be taken back; the server checks the same on the way in.
 * Something this browser has not read is let through for the server to judge.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { SearchIndex } from "#/data/search.server";
import { findCachedTask, stagesOf } from "#/lib/optimistic";
import { shortTitle } from "#/lib/tasks/tasks";
import { queryKeys } from "#/queries/keys";
import type { Change } from "#/schemas/change";
import type { ChecklistSummary } from "#/schemas/checklist";
import type { ItemRef } from "#/schemas/common";
import type { Tag, TagDetail, TagSummary } from "#/schemas/tag";
import type { TrackerSummary } from "#/schemas/tracker";

/** Whether one thing is done — `null` when this browser cannot tell. */
export function isItemDone(client: QueryClient, ref: ItemRef): boolean | null {
	switch (ref.kind) {
		case "task":
			return findCachedTask(client, ref.id)?.task.completed ?? null;

		case "checklist": {
			const checklist =
				client.getQueryData<ChecklistSummary>(queryKeys.checklist(ref.id)) ??
				client
					.getQueryData<Array<ChecklistSummary>>(queryKeys.checklists)
					?.find((each) => each.checklistId === ref.id);
			if (checklist === undefined) return null;
			const { total, completed } = checklist.progress;
			return total > 0 && completed >= total;
		}

		case "tracker": {
			const tracker = client
				.getQueryData<Array<TrackerSummary>>(queryKeys.trackers)
				?.find((each) => each.trackerId === ref.id);
			return tracker === undefined ? null : tracker.progress.percent >= 100;
		}

		case "tag": {
			const summary =
				client
					.getQueryData<Array<TagSummary>>(queryKeys.tagSummaries)
					?.find((each) => each.tagId === ref.id)?.progress ??
				client
					.getQueriesData<TagDetail>({ queryKey: queryKeys.tags })
					.find(
						([key, detail]) => key.length === 2 && detail?.tagId === ref.id,
					)?.[1]?.progress;
			if (summary !== undefined) {
				return summary.total > 0 && summary.completed >= summary.total;
			}

			const tasks = client
				.getQueryData<SearchIndex>(queryKeys.searchIndex)
				?.tasks.filter((task) => task.tagIds.includes(ref.id));
			if (tasks === undefined) return null;
			return tasks.length > 0 && tasks.every((task) => task.completed);
		}
	}
}

/** How a refusal names one thing: `task "Write the brief"`, `tag #launch`. */
export function describeItem(client: QueryClient, ref: ItemRef): string {
	switch (ref.kind) {
		case "task": {
			const task = findCachedTask(client, ref.id)?.task;
			return task ? `task "${shortTitle(task.title, 40)}"` : "a task";
		}
		case "checklist": {
			const title = client
				.getQueryData<SearchIndex>(queryKeys.searchIndex)
				?.checklists.find((each) => each.checklistId === ref.id)?.title;
			return title ? `checklist "${shortTitle(title, 40)}"` : "a checklist";
		}
		case "tracker": {
			const title = client
				.getQueryData<Array<TrackerSummary>>(queryKeys.trackers)
				?.find((each) => each.trackerId === ref.id)?.title;
			return title ? `tracker "${shortTitle(title, 40)}"` : "a tracker";
		}
		case "tag": {
			const name = client
				.getQueryData<Array<Tag>>(queryKeys.tags)
				?.find((each) => each.tagId === ref.id)?.name;
			return name ? `tag #${name}` : "a tag";
		}
	}
}

/**
 * Why a change may not be made: a task being finished while something it
 * waits on is not done yet. `null` for any change that is fine.
 */
export function whyBlocked(client: QueryClient, change: Change): string | null {
	if (change.kind !== "task.update") return null;

	const found = findCachedTask(client, change.taskId);
	if (found === null || found.task.completed) return null;

	const { patch } = change;
	const stages = stagesOf(client, found.checklistId);
	const finishes =
		patch.completed === true ||
		(patch.stageId !== undefined &&
			patch.stageId === stages[stages.length - 1].stageId);
	if (!finishes) return null;

	const undone = (found.task.dependsOn ?? []).find(
		(ref) => isItemDone(client, ref) === false,
	);
	return undone === undefined
		? null
		: `Can't complete this yet: ${describeItem(client, undone)} is not done.`;
}
