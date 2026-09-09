/**
 * Turning a user action into a queued change.
 *
 * Every mutation in the app goes through here, for two reasons. The label a
 * change carries has to be written while the screen still knows the titles
 * involved, and the review dialog reads far better when that wording is decided
 * in one place than when each screen invents its own. Ids are minted here too,
 * so a queued change can be shown, referred to by a later change, and replayed
 * on the server without ever being renumbered.
 */

import { createId, ID_PREFIX } from "#/lib/ids";
import { enqueue } from "#/lib/pending/store";
import { sameTagName } from "#/lib/tags/inline-tags";
import type { Checklist } from "#/schemas/checklist";
import { TAG_COLORS, type Tag, type TagColor } from "#/schemas/tag";
import type { Task, TaskPatch } from "#/schemas/task";
import type { TaskListName } from "#/schemas/task-list";
import { TASK_LIST_LABELS } from "#/schemas/task-list";
import type { ProgressEntry, Tracker } from "#/schemas/tracker";

/** Keeps a long title from swamping the review dialog. */
function quote(title: string): string {
	const trimmed = title.trim();
	return `"${trimmed.length > 48 ? `${trimmed.slice(0, 47)}…` : trimmed}"`;
}

/* -------------------------------------------------------------------------- */
/* Checklists                                                                 */
/* -------------------------------------------------------------------------- */

export type ChecklistValues = {
	title: string;
	description: string;
	startDate: string;
	deadline: string | null;
};

/** Returns the new id so the caller can navigate straight into it. */
export function queueCreateChecklist(values: ChecklistValues): string {
	const checklistId = createId(ID_PREFIX.checklist);

	enqueue({
		label: `New checklist ${quote(values.title)}`,
		change: { kind: "checklist.create", checklistId, ...values },
	});

	return checklistId;
}

export function queueUpdateChecklist(
	checklist: Checklist,
	patch: Partial<ChecklistValues>,
): void {
	enqueue({
		label: `Edit checklist ${quote(checklist.title)}`,
		change: {
			kind: "checklist.update",
			checklistId: checklist.checklistId,
			patch,
		},
	});
}

export function queueDeleteChecklist(checklist: Checklist): void {
	enqueue({
		label: `Delete checklist ${quote(checklist.title)}`,
		change: {
			kind: "checklist.delete",
			checklistId: checklist.checklistId,
		},
	});
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export function queueCreateTask(input: {
	checklistId: string;
	title: string;
	tagIds: Array<string>;
	urgent?: boolean;
	important?: boolean;
}): string {
	const taskId = createId(ID_PREFIX.task);

	enqueue({
		label: `Add task ${quote(input.title)}`,
		// Stamped now rather than on the server: this is the moment the user
		// added it, and it is what the list is ordered by from here on.
		change: {
			kind: "task.create",
			taskId,
			addedAt: new Date().toISOString(),
			urgent: false,
			important: false,
			...input,
		},
	});

	return taskId;
}

/** What a patch is, said the way the user would say it. */
function describeTaskPatch(task: Task, patch: TaskPatch): string {
	if (patch.completed === true) return `Complete ${quote(task.title)}`;
	if (patch.completed === false) return `Reopen ${quote(task.title)}`;

	if (patch.urgent !== undefined) {
		return patch.urgent
			? `Mark ${quote(task.title)} urgent`
			: `${quote(task.title)} is no longer urgent`;
	}

	if (patch.important !== undefined) {
		return patch.important
			? `Mark ${quote(task.title)} important`
			: `${quote(task.title)} is no longer important`;
	}

	if (patch.tagIds !== undefined && patch.title === undefined) {
		return `Change tags on ${quote(task.title)}`;
	}

	return `Edit task ${quote(patch.title ?? task.title)}`;
}

export function queueUpdateTask(
	checklistId: string,
	task: Task,
	patch: TaskPatch,
): void {
	const label = describeTaskPatch(task, patch);

	enqueue({
		label,
		change: { kind: "task.update", checklistId, taskId: task.taskId, patch },
	});
}

export function queueDeleteTask(checklistId: string, task: Task): void {
	enqueue({
		label: `Delete task ${quote(task.title)}`,
		change: { kind: "task.delete", checklistId, taskId: task.taskId },
	});
}

/* -------------------------------------------------------------------------- */
/* Today and Backlog                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The preview is what lets Today draw a row for a task it has not fetched. See
 * `QueuedChange` for why it is kept on the queue rather than resolved later.
 */
export function queueAddRef(input: {
	list: TaskListName;
	checklistId: string;
	checklistTitle: string;
	task: Pick<
		Task,
		"taskId" | "title" | "completed" | "tagIds" | "urgent" | "important"
	>;
	sortOrder: number;
}): void {
	enqueue({
		label: `Move ${quote(input.task.title)} to ${TASK_LIST_LABELS[input.list]}`,
		preview: {
			title: input.task.title,
			completed: input.task.completed,
			checklistTitle: input.checklistTitle,
			tagIds: input.task.tagIds,
			urgent: input.task.urgent,
			important: input.task.important,
		},
		change: {
			kind: "ref.add",
			list: input.list,
			itemId: createId(ID_PREFIX.listItem),
			checklistId: input.checklistId,
			taskId: input.task.taskId,
			sortOrder: input.sortOrder,
		},
	});
}

export function queueRemoveRef(input: {
	list: TaskListName;
	itemId: string;
	title: string;
}): void {
	enqueue({
		label: `Take ${quote(input.title)} off ${TASK_LIST_LABELS[input.list]}`,
		change: { kind: "ref.remove", list: input.list, itemId: input.itemId },
	});
}

export function queueMoveRef(input: {
	list: TaskListName;
	itemId: string;
	title: string;
	direction: "up" | "down";
}): void {
	enqueue({
		label: `Move ${quote(input.title)} ${input.direction}`,
		change: {
			kind: "ref.move",
			list: input.list,
			itemId: input.itemId,
			direction: input.direction,
		},
	});
}

/* -------------------------------------------------------------------------- */
/* Trackers                                                                   */
/* -------------------------------------------------------------------------- */

export type TrackerValues = {
	title: string;
	type: Tracker["type"];
	unit: string;
	targetValue: number;
	startDate: string;
	deadline: string | null;
	description: string;
	coverUrl: string | null;
	author: string;
};

export function queueCreateTracker(values: TrackerValues): string {
	const trackerId = createId(ID_PREFIX.tracker);

	enqueue({
		label: `New tracker ${quote(values.title)}`,
		change: { kind: "tracker.create", trackerId, ...values },
	});

	return trackerId;
}

export function queueUpdateTracker(
	tracker: Tracker,
	patch: Partial<TrackerValues>,
): void {
	enqueue({
		label: `Edit tracker ${quote(tracker.title)}`,
		change: { kind: "tracker.update", trackerId: tracker.trackerId, patch },
	});
}

export function queueDeleteTracker(tracker: Tracker): void {
	enqueue({
		label: `Delete tracker ${quote(tracker.title)}`,
		change: { kind: "tracker.delete", trackerId: tracker.trackerId },
	});
}

export type EntryValues = {
	value: number;
	recordedAt: string;
	note: string;
};

export function queueCreateEntry(
	tracker: Tracker,
	values: EntryValues,
): string {
	const entryId = createId(ID_PREFIX.entry);

	enqueue({
		label: `${quote(tracker.title)} at ${values.value} ${tracker.unit}`,
		change: {
			kind: "entry.create",
			trackerId: tracker.trackerId,
			entryId,
			...values,
		},
	});

	return entryId;
}

export function queueUpdateEntry(
	tracker: Tracker,
	entry: ProgressEntry,
	patch: Partial<EntryValues>,
): void {
	enqueue({
		label: `Edit progress on ${quote(tracker.title)}`,
		change: {
			kind: "entry.update",
			trackerId: tracker.trackerId,
			entryId: entry.entryId,
			patch,
		},
	});
}

export function queueDeleteEntry(tracker: Tracker, entry: ProgressEntry): void {
	enqueue({
		label: `Delete a reading from ${quote(tracker.title)}`,
		change: {
			kind: "entry.delete",
			trackerId: tracker.trackerId,
			entryId: entry.entryId,
		},
	});
}

/* -------------------------------------------------------------------------- */
/* Tags                                                                       */
/* -------------------------------------------------------------------------- */

export function queueCreateTag(values: {
	name: string;
	color: TagColor;
}): string {
	const tagId = createId(ID_PREFIX.tag);

	enqueue({
		label: `New tag ${quote(values.name)}`,
		change: { kind: "tag.create", tagId, ...values },
	});

	return tagId;
}

/**
 * The colour a tag written inline gets.
 *
 * Picked at random rather than fixed, so a set of tags typed in one go is
 * immediately distinguishable at a glance instead of being ten identical blue
 * chips. It is only a starting point: the Tags screen is where a colour is
 * chosen deliberately.
 */
function randomTagColor(): TagColor {
	return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

/**
 * Turn the names written as `#tags` into tag ids, minting the ones that do not
 * exist yet.
 *
 * The Tags screen is the master list, but a tag typed into a task still has to
 * become one or the task would silently lose it. Returns a resolver rather than
 * doing one name at a time so that a name used on three pasted lines is created
 * once, not three times — the first two would only exist in the queue, where
 * `existing` cannot see them.
 */
export function createTagResolver(
	existing: ReadonlyArray<Tag>,
): (name: string) => string {
	const minted = new Map<string, string>();

	return (name) => {
		const key = name.toLowerCase();

		const known = existing.find((tag) => sameTagName(tag.name, name));
		if (known) return known.tagId;

		const alreadyMinted = minted.get(key);
		if (alreadyMinted) return alreadyMinted;

		const tagId = queueCreateTag({ name, color: randomTagColor() });
		minted.set(key, tagId);
		return tagId;
	};
}

export function queueUpdateTag(
	tag: Tag,
	patch: { name?: string; color?: TagColor },
): void {
	enqueue({
		label:
			patch.name === undefined || patch.name === tag.name
				? `Recolour tag ${quote(tag.name)}`
				: `Rename tag ${quote(tag.name)} to ${quote(patch.name)}`,
		change: { kind: "tag.update", tagId: tag.tagId, patch },
	});
}

export function queueDeleteTag(tag: Tag): void {
	enqueue({
		label: `Delete tag ${quote(tag.name)}`,
		change: { kind: "tag.delete", tagId: tag.tagId },
	});
}
