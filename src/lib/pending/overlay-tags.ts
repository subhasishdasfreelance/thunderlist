/**
 * Showing queued tag edits before they reach the database.
 *
 * The Tags screen reads tasks from the search index, which already carries the
 * tag ids on each task, so both halves of the screen project from the queue
 * without an extra read.
 */

import type { SearchIndex } from "#/data/search.server";
import type { QueuedChange } from "#/schemas/pending";
import type { Tag } from "#/schemas/tag";

export type TaggedTask = SearchIndex["tasks"][number];

export function overlayTags(
	tags: ReadonlyArray<Tag>,
	queued: ReadonlyArray<QueuedChange>,
): Array<Tag> {
	let result = [...tags];

	for (const { change, queuedAt } of queued) {
		switch (change.kind) {
			case "tag.create":
				result = [
					...result,
					{
						tagId: change.tagId,
						name: change.name,
						color: change.color,
						createdAt: queuedAt,
						updatedAt: queuedAt,
					},
				];
				break;

			case "tag.update":
				result = result.map((tag) =>
					tag.tagId === change.tagId
						? { ...tag, ...change.patch, updatedAt: queuedAt }
						: tag,
				);
				break;

			case "tag.delete":
				result = result.filter((tag) => tag.tagId !== change.tagId);
				break;

			default:
				break;
		}
	}

	return result.sort((a, b) =>
		a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
	);
}

/**
 * The title of every checklist these tasks could belong to.
 *
 * A queued task needs the name of its checklist to render, and the search index
 * only names checklists that already have a task in it. The two sources here
 * cover the cases that actually arise: a checklist the queue just created
 * carries its own title, and an existing one is named by its other tasks.
 */
function checklistTitles(
	tasks: ReadonlyArray<TaggedTask>,
	queued: ReadonlyArray<QueuedChange>,
): Map<string, string> {
	const titles = new Map(
		tasks.map((task) => [task.checklistId, task.checklistTitle]),
	);

	for (const { change } of queued) {
		if (change.kind === "checklist.create") {
			titles.set(change.checklistId, change.title);
		} else if (change.kind === "checklist.update" && change.patch.title) {
			titles.set(change.checklistId, change.patch.title);
		}
	}

	return titles;
}

/**
 * Every task with its tags, queue included.
 *
 * Deleting a tag strips it from the tasks carrying it here as well as on the
 * server, so the Tags screen never shows a task labelled with something the
 * confirm is about to remove.
 */
export function overlayTaggedTasks(
	tasks: ReadonlyArray<TaggedTask>,
	queued: ReadonlyArray<QueuedChange>,
): Array<TaggedTask> {
	const titles = checklistTitles(tasks, queued);
	let result = tasks.map((task) => {
		const title = titles.get(task.checklistId);
		return title === undefined || title === task.checklistTitle
			? task
			: { ...task, checklistTitle: title };
	});

	for (const { change } of queued) {
		switch (change.kind) {
			case "task.create":
				result = [
					...result,
					{
						taskId: change.taskId,
						checklistId: change.checklistId,
						checklistTitle: titles.get(change.checklistId) ?? "",
						title: change.title,
						completed: false,
						tagIds: change.tagIds,
						urgent: change.urgent,
						important: change.important,
					},
				];
				break;

			case "task.update":
				result = result.map((task) =>
					task.taskId === change.taskId
						? {
								...task,
								title: change.patch.title ?? task.title,
								completed: change.patch.completed ?? task.completed,
								tagIds: change.patch.tagIds ?? task.tagIds,
							}
						: task,
				);
				break;

			case "task.delete":
				result = result.filter((task) => task.taskId !== change.taskId);
				break;

			case "checklist.delete":
				result = result.filter(
					(task) => task.checklistId !== change.checklistId,
				);
				break;

			case "tag.delete":
				result = result.map((task) =>
					task.tagIds.includes(change.tagId)
						? {
								...task,
								tagIds: task.tagIds.filter((id) => id !== change.tagId),
							}
						: task,
				);
				break;

			default:
				break;
		}
	}

	return result;
}
