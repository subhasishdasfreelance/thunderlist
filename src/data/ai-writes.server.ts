/**
 * The AI tools that change content. Server only; see `runAiTool`.
 *
 * None of them writes anything. Each works out the `Change`s that do what was
 * asked, the way a screen's builders do in `#/lib/changes`: ids minted here,
 * tags written into a title as they would be typed, a tag that does not exist
 * yet made first, many tasks changed as one `task.batch`. Whoever called makes
 * them; see `applyAiChanges` and `useWebMcp`.
 */

import { AppError } from "#/lib/errors";
import { createId, ID_PREFIX } from "#/lib/ids";
import { parseOutline } from "#/lib/outline";
import {
	parseInlineTags,
	sameTagName,
	sameTrackerName,
	withInlineTag,
	withoutInlineTag,
} from "#/lib/tags/inline-tags";
import type { AccessEntry } from "#/schemas/access";
import type { AiToolInput } from "#/schemas/ai-tools";
import type { BatchedChange, Change, PickableKind } from "#/schemas/change";
import { checklistStages, type Stage } from "#/schemas/checklist";
import type { ItemRef } from "#/schemas/common";
import { type GroupItem, sameItem } from "#/schemas/group";
import { PICKABLE_COLORS, type Tag, type TagColor } from "#/schemas/tag";
import { MAX_TASKS_AT_ONCE, type TaskPatch } from "#/schemas/task";
import { roleCan } from "#/schemas/team";
import { TRACKER_TYPE_DEFAULT_UNITS } from "#/schemas/tracker";
import type { AiContext, AiHandlers } from "./ai-context.server";
import {
	findChecklist,
	findCountdown,
	findGroup,
	findPlan,
	findStage,
	findTag,
	findTask,
	findTaskType,
	findTracker,
	type IndexedTask,
	type Lookup,
	pick,
	stagesOf,
	tagNamed,
	todayTag,
} from "./ai-lookup.server";
import { getPlan } from "./plan.server";
import { getTrackerEntries } from "./tracker.server";
import { assertLevel } from "./visibility.server";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** The colour something gets when none is asked for, as a typed tag does. */
function randomColor(): TagColor {
	return PICKABLE_COLORS[Math.floor(Math.random() * PICKABLE_COLORS.length)];
}

/** The fields actually given; refuses an edit that gives none. */
function given<T extends Record<string, unknown>>(fields: T): Partial<T> {
	const patch = Object.fromEntries(
		Object.entries(fields).filter(([, value]) => value !== undefined),
	) as Partial<T>;
	if (Object.keys(patch).length === 0) {
		throw new AppError("invalid_data", "Say what to change.");
	}
	return patch;
}

function canManageContent(context: AiContext): boolean {
	const { team } = context.scope;
	return team === null || roleCan(team.role, "manageContent");
}

/**
 * Who something new is for when the agent does not say: in a team, its maker
 * alone, as every form starts it; see `useOwnAlone`. Everyone in their own
 * space, where there is no one else.
 */
function ownAlone(context: AiContext): Array<AccessEntry> | null {
	return context.scope.team === null
		? null
		: [{ email: context.scope.email, level: "full" }];
}

/**
 * Tags by name, making the ones that do not exist yet — once each, however
 * often named — ahead of whatever uses them; see `createTagResolver`.
 *
 * Someone whose role cannot make tags gets `null` for a new name, as in the
 * app, where it stays in the title as plain words.
 */
function tagMaker(
	context: AiContext,
	tags: ReadonlyArray<Tag>,
	made: Array<Change>,
) {
	const minted = new Map<string, { tagId: string; name: string }>();

	return (written: string): { tagId: string; name: string } | null => {
		const name = written.trim().replace(/^#/, "");
		const known = tagNamed(tags, name);
		if (known) return known;

		const already = minted.get(name.toLowerCase());
		if (already) return already;
		if (!canManageContent(context)) return null;

		const tagId = createId(ID_PREFIX.tag);
		made.push({
			kind: "tag.create",
			tagId,
			name,
			color: randomColor(),
			description: "",
			startDate: null,
			deadline: null,
			deadlineTime: null,
			dailyWindow: null,
			// A tag written into a title is shared by nature, as in the app.
			access: null,
		});
		const tag = { tagId, name };
		minted.set(name.toLowerCase(), tag);
		return tag;
	};
}

type TagMaker = ReturnType<typeof tagMaker>;

/** Tags named outright, rather than typed in a title, have to exist. */
function namedTags(make: TagMaker, names: ReadonlyArray<string>) {
	return names.map((name) => {
		const tag = make(name);
		if (tag === null) {
			throw new AppError(
				"invalid_data",
				`There is no tag called ${name}, and only the team's project managers can make one.`,
			);
		}
		return tag;
	});
}

/** Task edits and moves as one change, in parts if need be; see `applyBatched`. */
function batched(changes: ReadonlyArray<BatchedChange>): Array<Change> {
	if (changes.length <= 1) return [...changes];
	const parts: Array<Change> = [];
	for (let at = 0; at < changes.length; at += 2 * MAX_TASKS_AT_ONCE) {
		parts.push({
			kind: "task.batch",
			changes: changes.slice(at, at + 2 * MAX_TASKS_AT_ONCE),
		});
	}
	return parts;
}

/** One thing deleted as its own change, several picked out as one. */
function deleting(
	of: PickableKind,
	ids: ReadonlyArray<string>,
	one: (id: string) => Change,
): Array<Change> {
	const unique = [...new Set(ids)];
	return unique.length === 1
		? [one(unique[0])]
		: [{ kind: "items.delete", of, ids: unique }];
}

async function findTasks(
	look: Lookup,
	refs: ReadonlyArray<string>,
): Promise<Array<IndexedTask>> {
	const found = await Promise.all(refs.map((ref) => findTask(look, ref)));
	return found.filter(
		(task, at) => found.findIndex((each) => each.taskId === task.taskId) === at,
	);
}

/** A thing a task waits on, or a group holds, by its kind and its reference. */
async function findItem(
	look: Lookup,
	item: { kind: ItemRef["kind"]; ref: string },
): Promise<ItemRef> {
	switch (item.kind) {
		case "task":
			return { kind: "task", id: (await findTask(look, item.ref)).taskId };
		case "checklist":
			return {
				kind: "checklist",
				id: (await findChecklist(look, item.ref)).checklistId,
			};
		case "tracker":
			return {
				kind: "tracker",
				id: (await findTracker(look, item.ref)).trackerId,
			};
		case "tag":
			return { kind: "tag", id: (await findTag(look, item.ref)).tagId };
	}
}

async function findGroupItems(
	look: Lookup,
	items: ReadonlyArray<{ kind: GroupItem["kind"]; ref: string }>,
): Promise<Array<GroupItem>> {
	return (await Promise.all(items.map((item) => findItem(look, item)))).map(
		(item) => item as GroupItem,
	);
}

/**
 * Stages by name, keeping the id of a stage whose name stays so its tasks
 * stay at it; see `Checklist.stages`.
 */
function stagesNamed(
	names: ReadonlyArray<string>,
	existing: ReadonlyArray<Stage>,
): Array<Stage> {
	return names.map((name) => {
		const kept = existing.find(
			(stage) => stage.name.toLowerCase() === name.trim().toLowerCase(),
		);
		return kept ?? { stageId: createId(ID_PREFIX.stage), name: name.trim() };
	});
}

type NewTask = AiToolInput<"add_tasks">["tasks"][number];

/**
 * New tasks, as the quick-add field makes them from typed lines: `#tags`
 * resolved (and made, where new), `-u` / `-i` read off the end, and a line
 * that is only `&Name` standing for that tracker or checklist. Many go as one
 * `task.createMany`; anything a line cannot say — a caption, a deadline — is
 * an edit after it, as the edit dialog would make it.
 */
async function newTasks(
	context: AiContext,
	look: Lookup,
	made: Array<Change>,
	options: {
		checklistId: string | null;
		lines: ReadonlyArray<NewTask>;
		/** Written into every task's title as well: Today, or tags named. */
		extraTags: ReadonlyArray<string>;
	},
): Promise<Array<{ taskId: string; title: string }>> {
	const make = tagMaker(context, await look.tags(), made);
	const extra = namedTags(make, options.extraTags);
	const parsed = options.lines.map((line) => parseInlineTags(line.title));
	const isLinking = parsed.some((line) => line.trackerName !== null);
	const [trackers, index] = isLinking
		? await Promise.all([look.trackers(), look.index()])
		: [[], null];

	const now = Date.now();
	const tasks = parsed.map((line, at) => {
		const name = line.trackerName;
		const tracker =
			name === null
				? undefined
				: trackers.find((each) => sameTrackerName(each.title, name));
		const linked =
			name === null || tracker !== undefined
				? undefined
				: index?.checklists.find(
						(each) =>
							each.checklistId !== options.checklistId &&
							sameTrackerName(each.title, name),
					);
		const isLinked = tracker !== undefined || linked !== undefined;

		// A line standing for something takes its title, and its tags go on it
		// unwritten, as a tracker added to Today does.
		const title = isLinked
			? (tracker?.title ?? linked?.title ?? line.title)
			: extra.reduce((text, tag) => withInlineTag(text, tag.name), line.title);
		const tagIds = isLinked
			? extra.map((tag) => tag.tagId)
			: parseInlineTags(title).tagNames.flatMap(
					(each) => make(each)?.tagId ?? [],
				);

		return {
			taskId: createId(ID_PREFIX.task),
			title,
			// A millisecond apart, first line newest, as `createTasks` stamps a paste.
			addedAt: new Date(now - at).toISOString(),
			tagIds: [...new Set(tagIds)],
			trackerId: tracker?.trackerId ?? null,
			linkedChecklistId: linked?.checklistId ?? null,
			urgent: options.lines[at].urgent ?? line.urgent,
			important: options.lines[at].important ?? line.important,
		};
	});

	if (tasks.length === 1) {
		made.push({
			kind: "task.create",
			checklistId: options.checklistId,
			...tasks[0],
		});
	} else {
		for (let at = 0; at < tasks.length; at += MAX_TASKS_AT_ONCE) {
			made.push({
				kind: "task.createMany",
				checklistId: options.checklistId,
				tasks: tasks.slice(at, at + MAX_TASKS_AT_ONCE),
			});
		}
	}

	const edits: Array<BatchedChange> = [];
	for (const [at, line] of options.lines.entries()) {
		const typeId =
			line.type === undefined
				? undefined
				: ((await findTaskType(look, line.type))?.typeId ?? null);
		const patch: TaskPatch = Object.fromEntries(
			Object.entries({
				caption: line.caption,
				notes: line.notes,
				deadline: line.deadline,
				typeId,
				assignees: line.assignees,
			}).filter(([, value]) => value !== undefined),
		);
		if (Object.keys(patch).length > 0) {
			edits.push({ kind: "task.update", taskId: tasks[at].taskId, patch });
		}
	}
	made.push(...batched(edits));

	return tasks.map(({ taskId, title }) => ({ taskId, title }));
}

/**
 * A task's title and tags after a new title, tags put on and tags taken off —
 * one answer kept in two places, so both move together; see `setTag`.
 */
function retagged(
	task: Pick<IndexedTask, "title" | "tagIds">,
	tags: ReadonlyArray<Tag>,
	make: TagMaker,
	change: {
		title?: string;
		add: ReadonlyArray<string>;
		remove: ReadonlyArray<string>;
	},
): { title: string; tagIds: Array<string> } {
	let title = task.title;
	let tagIds = [...task.tagIds];

	if (change.title !== undefined) {
		// A tag no longer written in the title comes off; a newly written one goes on.
		const after = parseInlineTags(change.title).tagNames;
		const dropped = parseInlineTags(task.title)
			.tagNames.filter((name) => !after.some((each) => sameTagName(each, name)))
			.flatMap((name) => tagNamed(tags, name)?.tagId ?? []);
		title = change.title;
		tagIds = [
			...tagIds.filter((tagId) => !dropped.includes(tagId)),
			...after.flatMap((name) => make(name)?.tagId ?? []),
		];
	}
	for (const tag of namedTags(make, change.add)) {
		title = withInlineTag(title, tag.name);
		tagIds.push(tag.tagId);
	}
	for (const name of change.remove) {
		const tag = tagNamed(tags, name);
		if (tag === undefined) continue;
		title = withoutInlineTag(title, tag.name);
		tagIds = tagIds.filter((tagId) => tagId !== tag.tagId);
	}
	return { title, tagIds: [...new Set(tagIds)] };
}

/* -------------------------------------------------------------------------- */
/* Tools                                                                      */
/* -------------------------------------------------------------------------- */

export const WRITE_TOOLS: AiHandlers<
	| "add_tasks"
	| "update_tasks"
	| "move_tasks"
	| "delete_tasks"
	| "create_checklist"
	| "update_checklist"
	| "delete_checklists"
	| "update_tag"
	| "delete_tags"
	| "create_tracker"
	| "update_tracker"
	| "delete_trackers"
	| "record_progress"
	| "update_reading"
	| "delete_readings"
	| "create_group"
	| "import_group"
	| "update_group"
	| "delete_group"
	| "create_plan"
	| "update_plan"
	| "delete_plans"
	| "create_countdown"
	| "update_countdown"
	| "delete_countdowns"
	| "set_task_types"
	| "set_order"
	| "share"
> = {
	/* Tasks ------------------------------------------------------------------ */

	add_tasks: async (context, input, look) => {
		const checklist =
			input.checklist === undefined
				? null
				: await findChecklist(look, input.checklist);
		const extraTags = [
			...(input.tags ?? []),
			...(input.today === true ? [(await todayTag(look)).name] : []),
		];
		const changes: Array<Change> = [];
		const added = await newTasks(context, look, changes, {
			checklistId: checklist?.checklistId ?? null,
			lines: input.tasks,
			extraTags,
		});
		return {
			changes,
			result: { added, checklist: checklist?.title ?? "Inbox" },
		};
	},

	update_tasks: async (context, input, look) => {
		const tasks = await findTasks(look, input.tasks);
		if (input.title !== undefined && tasks.length > 1) {
			throw new AppError(
				"invalid_data",
				"A title can only be given to one task at a time.",
			);
		}
		if (input.done !== undefined && input.stage !== undefined) {
			throw new AppError(
				"invalid_data",
				"Give either done or stage, not both.",
			);
		}

		const tags = await look.tags();
		const changes: Array<Change> = [];
		const make = tagMaker(context, tags, changes);
		const today =
			input.today === undefined ? null : (await todayTag(look)).name;
		const typeId =
			input.type === undefined
				? undefined
				: ((await findTaskType(look, input.type))?.typeId ?? null);
		const dependsOn =
			input.dependsOn === undefined
				? undefined
				: await Promise.all(
						input.dependsOn.map((item) => findItem(look, item)),
					);

		const edits: Array<BatchedChange> = [];
		for (const task of tasks) {
			const stages = await stagesOf(look, task);
			const patch: TaskPatch = {};

			const { title, tagIds } = retagged(task, tags, make, {
				title: input.title,
				add: [
					...(input.addTags ?? []),
					...(input.today === true && today ? [today] : []),
				],
				remove: [
					...(input.removeTags ?? []),
					...(input.today === false && today ? [today] : []),
				],
			});
			if (title !== task.title) patch.title = title;
			if (
				tagIds.length !== task.tagIds.length ||
				tagIds.some((tagId) => !task.tagIds.includes(tagId))
			) {
				patch.tagIds = tagIds;
			}

			// Done is the last stage and open the first, as a tick moves it.
			const stageId =
				input.stage !== undefined
					? findStage(stages, input.stage).stageId
					: input.done === undefined
						? undefined
						: input.done
							? stages[stages.length - 1].stageId
							: stages[0].stageId;
			if (stageId !== undefined && stageId !== task.stageId) {
				patch.stageId = stageId;
			}

			if (input.caption !== undefined) patch.caption = input.caption;
			if (input.notes !== undefined) patch.notes = input.notes;
			if (input.deadline !== undefined) patch.deadline = input.deadline;
			if (input.urgent !== undefined) patch.urgent = input.urgent;
			if (input.important !== undefined) patch.important = input.important;
			if (typeId !== undefined) patch.typeId = typeId;
			if (dependsOn !== undefined) patch.dependsOn = dependsOn;

			if (
				input.assignees !== undefined ||
				input.addAssignees !== undefined ||
				input.removeAssignees !== undefined
			) {
				const people = new Set(input.assignees ?? task.assignees ?? []);
				for (const email of input.addAssignees ?? []) people.add(email);
				for (const email of input.removeAssignees ?? []) people.delete(email);
				patch.assignees = [...people];
			}

			if (input.subtasks !== undefined) {
				const existing = task.subtasks ?? [];
				patch.subtasks = input.subtasks.map((subtask) => {
					const kept = existing.find(
						(each) => each.title.toLowerCase() === subtask.title.toLowerCase(),
					);
					return {
						subtaskId: kept?.subtaskId ?? createId(ID_PREFIX.subtask),
						title: subtask.title,
						done: subtask.done ?? kept?.done ?? false,
					};
				});
			}

			if (Object.keys(patch).length > 0) {
				edits.push({ kind: "task.update", taskId: task.taskId, patch });
			}
		}

		changes.push(...batched(edits));
		return {
			changes,
			result: {
				updated: edits.length,
				unchanged: tasks.length - edits.length,
			},
		};
	},

	move_tasks: async (_context, input, look) => {
		const [tasks, to] = await Promise.all([
			findTasks(look, input.tasks),
			findChecklist(look, input.to),
		]);
		// Parking a task takes it off Today: planned or parked, never both.
		const today = to.special === "backlog" ? await todayTag(look) : null;

		const moves: Array<BatchedChange> = [];
		for (const task of tasks) {
			if (task.checklistId === to.checklistId) continue;
			if (today !== null && task.tagIds.includes(today.tagId)) {
				moves.push({
					kind: "task.update",
					taskId: task.taskId,
					patch: {
						title: withoutInlineTag(task.title, today.name),
						tagIds: task.tagIds.filter((tagId) => tagId !== today.tagId),
					},
				});
			}
			moves.push({
				kind: "task.move",
				taskId: task.taskId,
				checklistId: to.checklistId,
			});
		}
		return {
			changes: batched(moves),
			result: {
				moved: moves.filter((each) => each.kind === "task.move").length,
				to: to.title,
			},
		};
	},

	delete_tasks: async (_context, input, look) => {
		const ids = (await findTasks(look, input.tasks)).map((task) => task.taskId);
		const changes: Array<Change> =
			ids.length === 1
				? [{ kind: "task.delete", taskId: ids[0] }]
				: [{ kind: "task.deleteMany", taskIds: ids }];
		return { changes, result: { deleted: ids.length } };
	},

	/* Checklists ------------------------------------------------------------- */

	create_checklist: async (context, input, look) => {
		const changes: Array<Change> = [];
		const make = tagMaker(context, await look.tags(), changes);
		const checklistId = createId(ID_PREFIX.checklist);

		changes.push({
			kind: "checklist.create",
			checklistId,
			title: input.title,
			description: input.description ?? "",
			startDate: input.startDate ?? context.today,
			deadline: input.deadline ?? null,
			deadlineTime: input.deadlineTime ?? null,
			dailyWindow: input.dailyWindow ?? null,
			tagIds: namedTags(make, input.tags ?? []).map((tag) => tag.tagId),
			access: input.access === undefined ? ownAlone(context) : input.access,
			stages:
				input.stages === undefined ? undefined : stagesNamed(input.stages, []),
		});

		const added =
			input.tasks === undefined || input.tasks.length === 0
				? []
				: await newTasks(context, look, changes, {
						checklistId,
						lines: input.tasks.map((title) => ({ title })),
						extraTags: [],
					});

		return {
			changes,
			result: {
				checklistId,
				title: input.title,
				tasksAdded: added.length,
				path: `/checklists/${checklistId}`,
			},
		};
	},

	update_checklist: async (context, input, look) => {
		const checklist = await findChecklist(look, input.checklist);
		const changes: Array<Change> = [];
		const make = tagMaker(context, await look.tags(), changes);

		changes.push({
			kind: "checklist.update",
			checklistId: checklist.checklistId,
			patch: given({
				title: input.title,
				description: input.description,
				startDate: input.startDate,
				deadline: input.deadline,
				deadlineTime: input.deadlineTime,
				dailyWindow: input.dailyWindow,
				tagIds:
					input.tags === undefined
						? undefined
						: namedTags(make, input.tags).map((tag) => tag.tagId),
				stages:
					input.stages === undefined
						? undefined
						: stagesNamed(input.stages, checklistStages(checklist)),
				access: input.access,
			}),
		});
		return { changes, result: { updated: checklist.title } };
	},

	delete_checklists: async (_context, input, look) => {
		const checklists = await Promise.all(
			input.checklists.map((ref) => findChecklist(look, ref)),
		);
		if (checklists.some((checklist) => checklist.special != null)) {
			throw new AppError(
				"invalid_data",
				"The Inbox and the Backlog cannot be deleted.",
			);
		}
		const ids = checklists.map((checklist) => checklist.checklistId);
		return {
			changes: deleting("checklist", ids, (checklistId) => ({
				kind: "checklist.delete",
				checklistId,
			})),
			result: { deleted: checklists.map((checklist) => checklist.title) },
		};
	},

	/* Tags ------------------------------------------------------------------- */

	update_tag: async (_context, { tag: ref, ...fields }, look) => {
		const tag = await findTag(look, ref);
		return {
			changes: [{ kind: "tag.update", tagId: tag.tagId, patch: given(fields) }],
			result: { updated: tag.name },
		};
	},

	delete_tags: async (_context, input, look) => {
		const tags = await Promise.all(input.tags.map((ref) => findTag(look, ref)));
		if (tags.some((tag) => tag.special != null)) {
			throw new AppError("invalid_data", "Today cannot be deleted.");
		}
		return {
			changes: deleting(
				"tag",
				tags.map((tag) => tag.tagId),
				(tagId) => ({ kind: "tag.delete", tagId }),
			),
			result: { deleted: tags.map((tag) => tag.name) },
		};
	},

	/* Trackers --------------------------------------------------------------- */

	create_tracker: async (context, input, look) => {
		const changes: Array<Change> = [];
		const make = tagMaker(context, await look.tags(), changes);
		const trackerId = createId(ID_PREFIX.tracker);
		changes.push({
			kind: "tracker.create",
			trackerId,
			title: input.title,
			caption: input.caption ?? "",
			type: input.type,
			unit: input.unit ?? TRACKER_TYPE_DEFAULT_UNITS[input.type],
			targetValue: input.targetValue,
			startValue: input.startValue ?? 0,
			startDate: input.startDate ?? context.today,
			deadline: input.deadline ?? null,
			deadlineTime: input.deadlineTime ?? null,
			description: input.description ?? "",
			coverUrl: input.coverUrl ?? null,
			author: input.author ?? "",
			tagIds: namedTags(make, input.tags ?? []).map((tag) => tag.tagId),
			assignees: input.assignees ?? [],
			access: input.access === undefined ? ownAlone(context) : input.access,
		});
		return {
			changes,
			result: { trackerId, title: input.title, path: `/trackers/${trackerId}` },
		};
	},

	update_tracker: async (context, { tracker: ref, tags, ...fields }, look) => {
		const tracker = await findTracker(look, ref);
		const changes: Array<Change> = [];
		const make = tagMaker(context, await look.tags(), changes);
		changes.push({
			kind: "tracker.update",
			trackerId: tracker.trackerId,
			patch: given({
				...fields,
				tagIds:
					tags === undefined
						? undefined
						: namedTags(make, tags).map((tag) => tag.tagId),
			}),
		});
		return { changes, result: { updated: tracker.title } };
	},

	delete_trackers: async (_context, input, look) => {
		const trackers = await Promise.all(
			input.trackers.map((ref) => findTracker(look, ref)),
		);
		return {
			changes: deleting(
				"tracker",
				trackers.map((tracker) => tracker.trackerId),
				(trackerId) => ({ kind: "tracker.delete", trackerId }),
			),
			result: { deleted: trackers.map((tracker) => tracker.title) },
		};
	},

	record_progress: async (context, input, look) => {
		const tracker = await findTracker(look, input.tracker);
		const entryId = createId(ID_PREFIX.entry);
		return {
			changes: [
				{
					kind: "entry.create",
					trackerId: tracker.trackerId,
					entryId,
					value: input.value,
					recordedAt: input.date ?? context.today,
					note: input.note ?? "",
				},
			],
			result: {
				entryId,
				tracker: tracker.title,
				value: input.value,
				of: tracker.targetValue,
				unit: tracker.unit,
			},
		};
	},

	update_reading: async (context, input, look) => {
		const tracker = await findTracker(look, input.tracker);
		assertLevel(context.scope, "trackers", tracker.trackerId, "read");
		const entries = await getTrackerEntries(
			context.scope.ownerId,
			tracker.trackerId,
		);
		const entry = pick("reading", entries, input.entry, {
			id: (each) => each.entryId,
			name: (each) => each.recordedAt,
			number: { kind: "entry", of: (each) => each.number },
		});
		return {
			changes: [
				{
					kind: "entry.update",
					trackerId: tracker.trackerId,
					entryId: entry.entryId,
					patch: given({
						value: input.value,
						recordedAt: input.date,
						note: input.note,
					}),
				},
			],
			result: { updated: entry.entryId },
		};
	},

	delete_readings: async (context, input, look) => {
		const tracker = await findTracker(look, input.tracker);
		assertLevel(context.scope, "trackers", tracker.trackerId, "read");
		const entries = await getTrackerEntries(
			context.scope.ownerId,
			tracker.trackerId,
		);
		const ids = [
			...new Set(
				input.entries.map(
					(ref) =>
						pick("reading", entries, ref, {
							id: (each) => each.entryId,
							name: (each) => each.recordedAt,
							number: { kind: "entry", of: (each) => each.number },
						}).entryId,
				),
			),
		];
		const changes: Array<Change> =
			ids.length === 1
				? [
						{
							kind: "entry.delete",
							trackerId: tracker.trackerId,
							entryId: ids[0],
						},
					]
				: [
						{
							kind: "entry.deleteMany",
							trackerId: tracker.trackerId,
							entryIds: ids,
						},
					];
		return { changes, result: { deleted: ids.length } };
	},

	/* Groups, plans, countdowns ---------------------------------------------- */

	create_group: async (context, input, look) => {
		const groupId = createId(ID_PREFIX.group);
		return {
			changes: [
				{
					kind: "group.create",
					groupId,
					name: input.name,
					color: input.color ?? randomColor(),
					items: await findGroupItems(look, input.items ?? []),
					startDate: input.startDate ?? context.today,
					deadline: input.deadline ?? null,
					deadlineTime: input.deadlineTime ?? null,
					access: input.access === undefined ? ownAlone(context) : input.access,
				},
			],
			result: { groupId, name: input.name, path: `/groups/${groupId}` },
		};
	},

	import_group: async (context, input, look) => {
		const outline = parseOutline(input.outline);
		if (outline.checklists.length === 0) {
			throw new AppError("invalid_data", "Start a checklist with a # heading.");
		}
		const changes: Array<Change> = [];
		const make = tagMaker(context, await look.tags(), changes);
		const groupId = createId(ID_PREFIX.group);
		const now = Date.now();

		changes.push({
			kind: "group.import",
			groupId,
			name: input.name,
			color: input.color ?? randomColor(),
			startDate: context.today,
			trackers: [],
			checklists: outline.checklists.map((list) => ({
				checklistId: createId(ID_PREFIX.checklist),
				title: list.title,
				description: list.description,
				tasks: list.tasks.map((line, at) => ({
					taskId: createId(ID_PREFIX.task),
					title: line.title,
					addedAt: new Date(now - at).toISOString(),
					tagIds: line.tagNames.flatMap((name) => make(name)?.tagId ?? []),
					urgent: line.urgent,
					important: line.important,
				})),
			})),
		});
		return {
			changes,
			result: {
				groupId,
				checklists: outline.checklists.map((list) => ({
					title: list.title,
					tasks: list.tasks.length,
				})),
				linesSkipped: outline.skipped,
				path: `/groups/${groupId}`,
			},
		};
	},

	update_group: async (_context, input, look) => {
		const group = await findGroup(look, input.group);
		let items: Array<GroupItem> | undefined;
		if (
			input.items !== undefined ||
			input.addItems !== undefined ||
			input.removeItems !== undefined
		) {
			const [replaced, added, removed] = await Promise.all([
				input.items === undefined
					? group.items
					: findGroupItems(look, input.items),
				findGroupItems(look, input.addItems ?? []),
				findGroupItems(look, input.removeItems ?? []),
			]);
			items = [
				...replaced,
				...added.filter(
					(item) => !replaced.some((each) => sameItem(each, item)),
				),
			].filter((item) => !removed.some((each) => sameItem(each, item)));
		}
		return {
			changes: [
				{
					kind: "group.update",
					groupId: group.groupId,
					patch: given({
						name: input.name,
						color: input.color,
						items,
						startDate: input.startDate,
						deadline: input.deadline,
						deadlineTime: input.deadlineTime,
						access: input.access,
					}),
				},
			],
			result: { updated: group.name },
		};
	},

	delete_group: async (_context, input, look) => {
		const group = await findGroup(look, input.group);
		return {
			changes: [{ kind: "group.delete", groupId: group.groupId }],
			result: { deleted: group.name },
		};
	},

	create_plan: async (context, input) => {
		const planId = createId(ID_PREFIX.plan);
		return {
			changes: [
				{
					kind: "plan.create",
					planId,
					title: input.title,
					body: input.body,
					access: input.access === undefined ? ownAlone(context) : input.access,
				},
			],
			result: { planId, title: input.title, path: `/plans/${planId}` },
		};
	},

	update_plan: async (context, input, look) => {
		const found = await findPlan(look, input.plan);
		if (input.body !== undefined && input.append !== undefined) {
			throw new AppError(
				"invalid_data",
				"Give either body or append, not both.",
			);
		}
		let body = input.body;
		if (input.append !== undefined) {
			const current = (await getPlan(context.scope.ownerId, found.planId)).body;
			body =
				current.trim() === ""
					? input.append
					: `${current.trimEnd()}\n\n${input.append}`;
		}
		return {
			changes: [
				{
					kind: "plan.update",
					planId: found.planId,
					patch: given({ title: input.title, body, access: input.access }),
				},
			],
			result: { updated: found.title },
		};
	},

	delete_plans: async (_context, input, look) => {
		const plans = await Promise.all(
			input.plans.map((ref) => findPlan(look, ref)),
		);
		return {
			changes: deleting(
				"plan",
				plans.map((plan) => plan.planId),
				(planId) => ({ kind: "plan.delete", planId }),
			),
			result: { deleted: plans.map((plan) => plan.title) },
		};
	},

	create_countdown: async (context, input) => {
		const countdownId = createId(ID_PREFIX.countdown);
		return {
			changes: [
				{
					kind: "countdown.create",
					countdownId,
					title: input.title,
					date: input.date,
					time: input.time ?? null,
					color: input.color ?? randomColor(),
					format: input.format ?? "seconds",
					access: input.access === undefined ? ownAlone(context) : input.access,
				},
			],
			result: { countdownId, title: input.title },
		};
	},

	update_countdown: async (_context, { countdown: ref, ...fields }, look) => {
		const countdown = await findCountdown(look, ref);
		return {
			changes: [
				{
					kind: "countdown.update",
					countdownId: countdown.countdownId,
					patch: given(fields),
				},
			],
			result: { updated: countdown.title },
		};
	},

	delete_countdowns: async (_context, input, look) => {
		const countdowns = await Promise.all(
			input.countdowns.map((ref) => findCountdown(look, ref)),
		);
		return {
			changes: deleting(
				"countdown",
				countdowns.map((countdown) => countdown.countdownId),
				(countdownId) => ({ kind: "countdown.delete", countdownId }),
			),
			result: { deleted: countdowns.map((countdown) => countdown.title) },
		};
	},

	/* The space -------------------------------------------------------------- */

	set_task_types: async (_context, input, look) => {
		const existing = await look.taskTypes();
		// A type keeps its id, and so its tasks, while its name stays.
		const types = input.types.map((type) => {
			const kept = existing.find(
				(each) => each.name.toLowerCase() === type.name.toLowerCase(),
			);
			return {
				typeId: kept?.typeId ?? createId(ID_PREFIX.taskType),
				name: type.name,
				color: type.color ?? kept?.color ?? randomColor(),
			};
		});
		return {
			changes: [{ kind: "taskTypes.set", types }],
			result: { types: types.map((type) => type.name) },
		};
	},

	set_order: async (_context, input, look) => {
		const finders: Record<typeof input.list, (ref: string) => Promise<string>> =
			{
				checklists: async (ref) => (await findChecklist(look, ref)).checklistId,
				trackers: async (ref) => (await findTracker(look, ref)).trackerId,
				tags: async (ref) => (await findTag(look, ref)).tagId,
				plans: async (ref) => (await findPlan(look, ref)).planId,
			};
		const order = [
			...new Set(await Promise.all(input.order.map(finders[input.list]))),
		];
		return {
			changes: [
				{ kind: "arrangement.set", list: input.list, arrangement: { order } },
			],
			result: { ordered: order.length },
		};
	},

	share: async (_context, input, look) => {
		const idOf = async (ref: string): Promise<string> => {
			switch (input.kind) {
				case "plan":
					return (await findPlan(look, ref)).planId;
				case "countdown":
					return (await findCountdown(look, ref)).countdownId;
				case "group":
					return (await findGroup(look, ref)).groupId;
				default:
					return (await findItem(look, { kind: input.kind, ref })).id;
			}
		};
		const ids = await Promise.all(input.items.map(idOf));
		return {
			changes: [
				{
					kind: "items.share",
					of: input.kind,
					ids: [...new Set(ids)],
					access: input.access,
				},
			],
			result: { shared: ids.length },
		};
	},
};
