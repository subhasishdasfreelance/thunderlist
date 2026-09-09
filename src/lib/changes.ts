/**
 * Making a change.
 *
 * Every edit goes straight to the database and the screens refetch. There is no
 * queue to review and nothing to save: what you did is done.
 *
 * Ids are still minted here rather than on the server. A change carrying its
 * own id is replayable — asking twice for the same task is the same task, not
 * two — which is what makes retrying after a dropped connection safe.
 */

import { useToast } from "@astryxdesign/core/Toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { applyChangeFn } from "#/functions/change.functions";
import { errorMessage } from "#/lib/errors";
import { createId, ID_PREFIX } from "#/lib/ids";
import { applyOptimistically, restore, snapshot } from "#/lib/optimistic";
import { sameTagName } from "#/lib/tags/inline-tags";
import type { Change } from "#/schemas/change";
import { TAG_COLORS, type Tag, type TagColor } from "#/schemas/tag";
import type { TaskPatch } from "#/schemas/task";
import type { TaskListName } from "#/schemas/task-list";
import type { Tracker } from "#/schemas/tracker";

/**
 * Apply a change: on screen at once, on the server behind it.
 *
 * Everything is invalidated afterwards rather than the one query that changed:
 * deleting a tag touches every task, moving a task touches two lists and a
 * checklist's progress, and working out which is which for each of eighteen
 * operations would be a second copy of the data model to keep in step.
 */
export function useApplyChange() {
	const queryClient = useQueryClient();
	const toast = useToast();

	const mutation = useMutation({
		mutationFn: (change: Change) => applyChangeFn({ data: { change } }),

		/*
		 * Draw it first, ask afterwards.
		 *
		 * In-flight refetches are cancelled before patching, or one already on its
		 * way back would land on top with the old answer and the change would
		 * appear to undo itself.
		 */
		onMutate: async (change) => {
			await queryClient.cancelQueries();
			const previous = snapshot(queryClient);
			applyOptimistically(queryClient, change);
			return { previous };
		},

		// The guess was wrong. Put back exactly what was there rather than trying
		// to reverse each patch, which is where this kind of code usually breaks.
		onError: (error, _change, context) => {
			if (context?.previous) restore(queryClient, context.previous);
			toast({ body: errorMessage(error), type: "error", uniqueID: "change" });
		},

		// Settled, not success: a failure has just rolled the screen back to a
		// state that may itself be stale, so both paths want the server's answer.
		onSettled: () => queryClient.invalidateQueries(),
	});

	const apply = useCallback(
		(change: Change) => mutation.mutate(change),
		[mutation.mutate],
	);

	/** For a caller that needs one change to land before it makes the next. */
	const applyAsync = useCallback(
		(change: Change) => mutation.mutateAsync(change),
		[mutation.mutateAsync],
	);

	return { apply, applyAsync, isSaving: mutation.isPending };
}

export type ApplyChange = (change: Change) => void;

/* -------------------------------------------------------------------------- */
/* Builders                                                                   */
/* -------------------------------------------------------------------------- */

/*
 * Each of these mints the id its change needs and nothing more. They exist so a
 * screen says what the user did rather than assembling a payload, and so the
 * shape of a change lives in one place per kind.
 */

export type ChecklistValues = {
	title: string;
	description: string;
	startDate: string;
	deadline: string | null;
};

/** Returns the new id so the caller can navigate straight into it. */
export function createChecklist(
	apply: ApplyChange,
	values: ChecklistValues,
): string {
	const checklistId = createId(ID_PREFIX.checklist);
	apply({ kind: "checklist.create", checklistId, ...values });
	return checklistId;
}

export function createTask(
	apply: ApplyChange,
	input: {
		checklistId: string | null;
		title: string;
		tagIds: Array<string>;
	},
): string {
	const taskId = createId(ID_PREFIX.task);

	apply({
		kind: "task.create",
		taskId,
		addedAt: new Date().toISOString(),
		urgent: false,
		important: false,
		...input,
	});

	return taskId;
}

export function updateTask(
	apply: ApplyChange,
	taskId: string,
	patch: TaskPatch,
): void {
	apply({ kind: "task.update", taskId, patch });
}

export function addTaskRef(
	apply: ApplyChange,
	input: { list: TaskListName; taskId: string; sortOrder: number },
): void {
	apply({ kind: "ref.add", itemId: createId(ID_PREFIX.listItem), ...input });
}

export function createTracker(
	apply: ApplyChange,
	values: Omit<TrackerValues, never>,
): string {
	const trackerId = createId(ID_PREFIX.tracker);
	apply({ kind: "tracker.create", trackerId, ...values });
	return trackerId;
}

export type TrackerValues = {
	title: string;
	type: Tracker["type"];
	unit: string;
	targetValue: number;
	/** Where the count already stood on day one; see `Tracker.startValue`. */
	startValue: number;
	startDate: string;
	deadline: string | null;
	description: string;
	coverUrl: string | null;
	author: string;
};

export type EntryValues = { value: number; recordedAt: string; note: string };

export function createEntry(
	apply: ApplyChange,
	trackerId: string,
	values: EntryValues,
): string {
	const entryId = createId(ID_PREFIX.entry);
	apply({ kind: "entry.create", trackerId, entryId, ...values });
	return entryId;
}

export function createTag(
	apply: ApplyChange,
	values: { name: string; color: TagColor },
): string {
	const tagId = createId(ID_PREFIX.tag);
	apply({ kind: "tag.create", tagId, ...values });
	return tagId;
}

/** The colour a tag written inline gets; recolour it on the Tags screen. */
function randomTagColor(): TagColor {
	return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

/**
 * Turn the names written as `#tags` into tag ids, creating the ones that do not
 * exist yet.
 *
 * The Tags screen is the master list, but a tag typed into a task still has to
 * become one or the task would silently lose it. A resolver rather than one
 * call per name, so a name used on three pasted lines is created once.
 */
export function createTagResolver(
	apply: ApplyChange,
	existing: ReadonlyArray<Tag>,
): (name: string) => string {
	const minted = new Map<string, string>();

	return (name) => {
		const key = name.toLowerCase();

		const known = existing.find((tag) => sameTagName(tag.name, name));
		if (known) return known.tagId;

		const already = minted.get(key);
		if (already) return already;

		const tagId = createTag(apply, { name, color: randomTagColor() });
		minted.set(key, tagId);
		return tagId;
	};
}
