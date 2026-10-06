/**
 * The AI tools that read. Server only; see `runAiTool`.
 *
 * Each answers with plain, compact records: numbers written as people write
 * them (`T-42`), tags and types by name rather than id, and the path of the
 * page that shows each thing, so an agent can say where to find it.
 */

import { searchResults } from "#/components/shell/search-results";
import { AppError } from "#/lib/errors";
import { checklistStages } from "#/schemas/checklist";
import { daysUntil } from "#/schemas/countdown";
import { formatNumber, type NumberedKind } from "#/schemas/number";
import { type Tag, tagParam } from "#/schemas/tag";
import { NO_TYPE } from "#/schemas/task";
import { roleCan } from "#/schemas/team";
import { type AiHandlers, answer } from "./ai-context.server";
import {
	findChecklist,
	findPlan,
	findTag,
	findTask,
	findTaskType,
	findTracker,
	type IndexedTask,
	type Lookup,
	stagesOf,
} from "./ai-lookup.server";
import { listNotificationCodes } from "./notification-code.server";
import { getPlan } from "./plan.server";
import { listTagSummaries } from "./tag.server";
import { getSpace, listTeamDetails } from "./team.server";
import { getTrackerEntries } from "./tracker.server";
import { assertLevel } from "./visibility.server";

/** `T-42`, or nothing for one made a moment ago and not yet numbered. */
function numbered(
	kind: NumberedKind,
	number: number | undefined,
): string | undefined {
	return number === undefined ? undefined : formatNumber(kind, number);
}

function tagNames(tags: ReadonlyArray<Tag>, tagIds: ReadonlyArray<string>) {
	return tagIds.flatMap(
		(tagId) => tags.find((tag) => tag.tagId === tagId)?.name ?? [],
	);
}

/** A task as a list gives it. */
async function taskSummary(look: Lookup, task: IndexedTask) {
	const [tags, types, stages] = await Promise.all([
		look.tags(),
		look.taskTypes(),
		stagesOf(look, task),
	]);
	return {
		taskId: task.taskId,
		number: numbered("task", task.number),
		title: task.title,
		caption: task.caption || undefined,
		checklist: task.checklistTitle,
		stage: stages.find((stage) => stage.stageId === task.stageId)?.name,
		done: task.completed,
		urgent: task.urgent || undefined,
		important: task.important || undefined,
		deadline: task.deadline ?? undefined,
		tags: tagNames(tags, task.tagIds),
		type: types.find((type) => type.typeId === task.typeId)?.name,
		assignees:
			task.assignees === undefined || task.assignees.length === 0
				? undefined
				: task.assignees,
		path:
			task.checklistId === null
				? undefined
				: `/checklists/${task.checklistId}?task=${task.taskId}`,
	};
}

/** A task with everything on it. */
async function taskDetail(look: Lookup, task: IndexedTask) {
	const index = await look.index();
	const nameOf = (kind: string, id: string): string => {
		switch (kind) {
			case "task":
				return index.tasks.find((each) => each.taskId === id)?.title ?? id;
			case "checklist":
				return (
					index.checklists.find((each) => each.checklistId === id)?.title ?? id
				);
			case "tracker":
				return (
					index.trackers.find((each) => each.trackerId === id)?.title ?? id
				);
			default:
				return id;
		}
	};
	const tags = await look.tags();
	return {
		...(await taskSummary(look, task)),
		checklistId: task.checklistId,
		stages: (await stagesOf(look, task)).map((stage) => stage.name),
		notes: task.notes || undefined,
		subtasks: task.subtasks,
		dependsOn: task.dependsOn?.map((ref) => ({
			kind: ref.kind,
			id: ref.id,
			name:
				ref.kind === "tag"
					? (tags.find((tag) => tag.tagId === ref.id)?.name ?? ref.id)
					: nameOf(ref.kind, ref.id),
		})),
		standsFor:
			task.trackerId != null
				? { tracker: nameOf("tracker", task.trackerId) }
				: task.linkedChecklistId != null
					? { checklist: nameOf("checklist", task.linkedChecklistId) }
					: undefined,
		addedAt: task.addedAt,
		completedAt: task.completedAt ?? undefined,
	};
}

export const READ_TOOLS: AiHandlers<
	| "get_workspace"
	| "search"
	| "list_tasks"
	| "get_task"
	| "list_checklists"
	| "get_checklist"
	| "list_tags"
	| "list_trackers"
	| "get_tracker"
	| "list_groups"
	| "list_plans"
	| "get_plan"
	| "list_countdowns"
	| "list_teams"
	| "list_notification_codes"
> = {
	get_workspace: async ({ scope, person, today }, _input, look) => {
		const [space, tags, checklists, types] = await Promise.all([
			getSpace(person, scope.team?.teamId),
			look.tags(),
			look.checklists(),
			look.taskTypes(),
		]);
		const todayTag = tags.find((tag) => tag.special === "today");
		const special = (kind: "inbox" | "backlog") => {
			const found = checklists.find((each) => each.special === kind);
			return found && { checklistId: found.checklistId, title: found.title };
		};
		return answer({
			you: { name: person.name, email: scope.email },
			today,
			space:
				space.team === null
					? { kind: "personal" }
					: {
							kind: "team",
							teamId: space.team.teamId,
							name: space.team.name,
							yourRole: space.team.role,
							members: space.team.members.map((member) => ({
								email: member.email,
								name: member.name,
								role: member.role,
							})),
						},
			teams: space.teams,
			todayTag: todayTag && { tagId: todayTag.tagId, name: todayTag.name },
			inbox: special("inbox"),
			backlog: special("backlog"),
			taskTypes: types.map((type) => ({
				typeId: type.typeId,
				name: type.name,
			})),
		});
	},

	search: async (_context, { query }, look) => {
		const [index, tags, plans, countdowns, groups] = await Promise.all([
			look.index(),
			look.tags(),
			look.plans(),
			look.countdowns(),
			look.groups(),
		]);
		const results = searchResults(query, {
			index,
			tags,
			plans,
			countdowns,
			groups,
		});
		return answer(
			results.map((result) => {
				// A row on a page is opened with that row brought into view.
				const focus = Object.entries(result.focus ?? {}).find(
					([, id]) => id !== undefined,
				);
				return {
					number: result.number,
					name: result.label,
					// What it is, or for a task, where it lives.
					context: result.context,
					stage: result.stage?.name,
					path: focus ? `${result.to}?${focus[0]}=${focus[1]}` : result.to,
				};
			}),
		);
	},

	list_tasks: async (_context, input, look) => {
		const index = await look.index();
		const checklist =
			input.checklist === undefined
				? null
				: await findChecklist(look, input.checklist);
		const tag = input.tag === undefined ? null : await findTag(look, input.tag);
		const type =
			input.type === undefined
				? undefined
				: input.type.toLowerCase() === NO_TYPE
					? null
					: await findTaskType(look, input.type);
		const status = input.status ?? "open";
		const words = input.text?.trim().toLowerCase();

		const matching: Array<IndexedTask> = [];
		for (const task of index.tasks) {
			if (status === "open" && task.completed) continue;
			if (status === "done" && !task.completed) continue;
			if (checklist && task.checklistId !== checklist.checklistId) continue;
			if (tag && !task.tagIds.includes(tag.tagId)) continue;
			if (input.assignee && !(task.assignees ?? []).includes(input.assignee))
				continue;
			if (
				type !== undefined &&
				(task.typeId ?? null) !== (type?.typeId ?? null)
			)
				continue;
			if (input.urgent !== undefined && task.urgent !== input.urgent) continue;
			if (input.important !== undefined && task.important !== input.important)
				continue;
			if (input.dueBy && (task.deadline == null || task.deadline > input.dueBy))
				continue;
			if (
				words &&
				![task.title, task.caption, task.notes ?? ""].some((text) =>
					text.toLowerCase().includes(words),
				)
			)
				continue;
			if (input.stage) {
				const stages = await stagesOf(look, task);
				const at = stages.find((stage) => stage.stageId === task.stageId);
				if (at?.name.toLowerCase() !== input.stage.trim().toLowerCase())
					continue;
			}
			matching.push(task);
		}

		matching.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
		const shown = matching.slice(0, input.limit ?? 100);
		return answer({
			total: matching.length,
			shown: shown.length,
			tasks: await Promise.all(shown.map((task) => taskSummary(look, task))),
		});
	},

	get_task: async (_context, input, look) =>
		answer(await taskDetail(look, await findTask(look, input.task))),

	list_checklists: async (_context, _input, look) => {
		const [checklists, tags] = await Promise.all([
			look.checklists(),
			look.tags(),
		]);
		return answer(
			checklists.map((checklist) => ({
				checklistId: checklist.checklistId,
				number: numbered("checklist", checklist.number),
				title: checklist.title,
				description: checklist.description || undefined,
				special: checklist.special ?? undefined,
				startDate: checklist.startDate,
				deadline: checklist.deadline ?? undefined,
				deadlineTime: checklist.deadlineTime ?? undefined,
				dailyWindow: checklist.dailyWindow ?? undefined,
				stages: checklistStages(checklist).map((stage) => stage.name),
				tags: tagNames(tags, checklist.tagIds ?? []),
				progress: {
					done: checklist.progress.completed,
					total: checklist.progress.total,
					percent: checklist.progress.percent,
				},
				path: `/checklists/${checklist.checklistId}`,
			})),
		);
	},

	get_checklist: async ({ scope }, input, look) => {
		const checklist = await findChecklist(look, input.checklist);
		assertLevel(scope, "checklists", checklist.checklistId, "read");
		const [tags, index] = await Promise.all([look.tags(), look.index()]);
		const tasks = index.tasks
			.filter((task) => task.checklistId === checklist.checklistId)
			.sort(
				(a, b) =>
					Number(a.completed) - Number(b.completed) ||
					b.addedAt.localeCompare(a.addedAt),
			);
		const shown = tasks.slice(0, 200);
		return answer({
			checklistId: checklist.checklistId,
			number: numbered("checklist", checklist.number),
			title: checklist.title,
			description: checklist.description || undefined,
			special: checklist.special ?? undefined,
			startDate: checklist.startDate,
			deadline: checklist.deadline ?? undefined,
			deadlineTime: checklist.deadlineTime ?? undefined,
			dailyWindow: checklist.dailyWindow ?? undefined,
			tags: tagNames(tags, checklist.tagIds ?? []),
			access: checklist.access ?? undefined,
			stages: checklistStages(checklist).map((stage) => ({
				name: stage.name,
				tasks: checklist.progress.byStage[stage.stageId] ?? 0,
			})),
			progress: {
				done: checklist.progress.completed,
				total: checklist.progress.total,
				percent: checklist.progress.percent,
			},
			path: `/checklists/${checklist.checklistId}`,
			tasksShown: shown.length,
			tasks: await Promise.all(shown.map((task) => taskSummary(look, task))),
		});
	},

	list_tags: async ({ scope }) => {
		const tags = await listTagSummaries(scope.ownerId, scope.hidden);
		return answer(
			tags.map((tag) => ({
				tagId: tag.tagId,
				number: numbered("tag", tag.number),
				name: tag.name,
				color: tag.color,
				special: tag.special ?? undefined,
				description: tag.description || undefined,
				startDate: tag.startDate ?? undefined,
				deadline: tag.deadline ?? undefined,
				deadlineTime: tag.deadlineTime ?? undefined,
				dailyWindow: tag.dailyWindow ?? undefined,
				progress: {
					done: tag.progress.completed,
					total: tag.progress.total,
					percent: tag.progress.percent,
				},
				path: `/tags/${tagParam(tag)}`,
			})),
		);
	},

	list_trackers: async (_context, _input, look) => {
		const [trackers, tags] = await Promise.all([look.trackers(), look.tags()]);
		return answer(
			trackers.map((tracker) => ({
				trackerId: tracker.trackerId,
				number: numbered("tracker", tracker.number),
				title: tracker.title,
				caption: tracker.caption || undefined,
				type: tracker.type,
				unit: tracker.unit,
				startValue: tracker.startValue,
				currentValue: tracker.currentValue,
				targetValue: tracker.targetValue,
				percent: tracker.progress.percent,
				startDate: tracker.startDate,
				deadline: tracker.deadline ?? undefined,
				tags: tagNames(tags, tracker.tagIds ?? []),
				assignees: tracker.assignees?.length ? tracker.assignees : undefined,
				path: `/trackers/${tracker.trackerId}`,
			})),
		);
	},

	get_tracker: async ({ scope }, input, look) => {
		const tracker = await findTracker(look, input.tracker);
		assertLevel(scope, "trackers", tracker.trackerId, "read");
		const [entries, tags] = await Promise.all([
			getTrackerEntries(scope.ownerId, tracker.trackerId),
			look.tags(),
		]);
		return answer({
			...tracker,
			number: numbered("tracker", tracker.number),
			tagIds: undefined,
			tags: tagNames(tags, tracker.tagIds ?? []),
			path: `/trackers/${tracker.trackerId}`,
			readings: entries.map((entry) => ({
				entryId: entry.entryId,
				number: numbered("entry", entry.number),
				date: entry.recordedAt,
				value: entry.value,
				delta: entry.delta,
				note: entry.note || undefined,
				recordedBy: entry.recordedBy ?? undefined,
			})),
		});
	},

	list_groups: async (_context, _input, look) => {
		const [groups, index, tags] = await Promise.all([
			look.groups(),
			look.index(),
			look.tags(),
		]);
		const nameOf = (kind: string, id: string) =>
			kind === "checklist"
				? index.checklists.find((each) => each.checklistId === id)?.title
				: kind === "tracker"
					? index.trackers.find((each) => each.trackerId === id)?.title
					: tags.find((tag) => tag.tagId === id)?.name;
		return answer(
			groups.map((group) => ({
				groupId: group.groupId,
				number: numbered("group", group.number),
				name: group.name,
				color: group.color,
				startDate: group.startDate,
				deadline: group.deadline ?? undefined,
				deadlineTime: group.deadlineTime ?? undefined,
				// Something since deleted, or kept from this person, is left out.
				items: group.items.flatMap((item) => {
					const name = nameOf(item.kind, item.id);
					return name === undefined ? [] : [{ ...item, name }];
				}),
				path: `/groups/${group.groupId}`,
			})),
		);
	},

	list_plans: async (_context, _input, look) =>
		answer(
			(await look.plans()).map((plan) => ({
				planId: plan.planId,
				number: numbered("plan", plan.number),
				title: plan.title,
				characters: plan.length,
				updatedAt: plan.updatedAt,
				path: `/plans/${plan.planId}`,
			})),
		),

	get_plan: async ({ scope }, input, look) => {
		const found = await findPlan(look, input.plan);
		const plan = await getPlan(scope.ownerId, found.planId);
		return answer({
			...plan,
			number: numbered("plan", plan.number),
			path: `/plans/${plan.planId}`,
		});
	},

	list_countdowns: async ({ today }, _input, look) =>
		answer(
			(await look.countdowns()).map((countdown) => ({
				countdownId: countdown.countdownId,
				number: numbered("countdown", countdown.number),
				title: countdown.title,
				date: countdown.date,
				time: countdown.time ?? null,
				daysLeft: daysUntil(countdown.date, today),
				color: countdown.color,
				format: countdown.format ?? "seconds",
			})),
		),

	list_teams: async ({ scope }) => answer(await listTeamDetails(scope.email)),

	list_notification_codes: async ({ scope }) => {
		if (scope.team !== null && !roleCan(scope.team.role, "manageContent")) {
			throw new AppError(
				"invalid_data",
				"Only the team's project managers can have notification codes.",
			);
		}
		return answer(await listNotificationCodes(scope.ownerId, scope.email));
	},
};
