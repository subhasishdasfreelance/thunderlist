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
	 * Put the tag on all of them, or — where that is a single task already
	 * carrying it — take it off again.
	 *
	 * One task is a toggle, because the tick beside it says it is on and
	 * pressing something that says "on" should turn it off. Several is always
	 * adding: they need not agree about it, and giving them all the same tag is
	 * the only reason to have picked them out.
	 */
	function put(tag: Pick<Tag, "tagId" | "name">) {
		if (tasks === null) return;

		const isOn = tasks.length === 1 && tasks[0].tagIds.includes(tag.tagId);
		for (const task of tasks) setTag(apply, task, tag, !isOn);
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
