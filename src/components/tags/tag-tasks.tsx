import { createTagResolver, setTag, useApplyChange } from "#/lib/changes";
import { sharedTagIds } from "#/lib/tasks/tasks";
import type { Tag } from "#/schemas/tag";
import type { Task } from "#/schemas/task";
import { TagPickerDialog } from "./tag-picker-dialog";

/** As much of a task as tagging one needs to know. */
type Taggable = Pick<Task, "taskId" | "title" | "tagIds">;

/**
 * Putting a tag on a task, or on every task picked out — `#` on a row, and
 * "Add tag" in the bar over a selection.
 *
 * Every screen that lists tasks offers both, and each of them wants the same
 * five answers: which tags exist, which of them these tasks already share,
 * whether this person may make a new one, what to write, and what to close.
 * Answering that in each screen was the same twenty-five lines four times
 * over, so it is answered here and each screen says only which tasks.
 */
export function TagTasks({
	tasks,
	tags,
	canCreate,
	onClose,
}: {
	/** The tasks being tagged, or `null` while nothing is. */
	tasks: ReadonlyArray<Taggable> | null;
	/** Every tag there is. */
	tags: ReadonlyArray<Tag>;
	/** Whether a name matching no tag may become one; see `Capability`. */
	canCreate: boolean;
	onClose: () => void;
}) {
	const { apply } = useApplyChange();

	/**
	 * A toggle, for one task or several: the tag goes on every one of them —
	 * the ones still without it — unless every one already carries it, when
	 * it comes off them all.
	 *
	 * The tick beside a tag says exactly that — on all of them — so pressing
	 * something ticked turns it off, and pressing it again puts it back.
	 */
	function put(tag: Pick<Tag, "tagId" | "name">) {
		if (tasks === null) return;

		const isOnAll = tasks.every((task) => task.tagIds.includes(tag.tagId));
		for (const task of tasks) {
			if (task.tagIds.includes(tag.tagId) !== !isOnAll) {
				setTag(apply, task, tag, !isOnAll);
			}
		}
		onClose();
	}

	return (
		<TagPickerDialog
			isOpen={tasks !== null}
			onOpenChange={(isOpen) => {
				if (!isOpen) onClose();
			}}
			tags={tags}
			subtitle={
				tasks?.length === 1
					? (tasks[0]?.title ?? "")
					: `${tasks?.length ?? 0} tasks`
			}
			current={sharedTagIds(tasks)}
			canCreate={canCreate}
			onPick={put}
			onCreate={(name) => {
				// A name nobody has used yet becomes a tag, as typing `#name` into
				// a title does; see `createTagResolver`.
				const tagId = createTagResolver(apply, tags, canCreate)(name);
				if (tagId === null) onClose();
				else put({ tagId, name });
			}}
		/>
	);
}
