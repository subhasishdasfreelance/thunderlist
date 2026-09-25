import { describe, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import type { Page, StagePage } from "#/lib/tasks/tasks";
import { queryKeys } from "#/queries/keys";
import type { Arrangements } from "#/schemas/arrangement";
import type { ChecklistSummary } from "#/schemas/checklist";
import type { Plan, PlanSummary } from "#/schemas/plan";
import type { Reminder } from "#/schemas/reminder";
import type { Tag, TagDetail, TagTaskEntry } from "#/schemas/tag";
import type { Task, TaskPageView } from "#/schemas/task";
import type { TaskType } from "#/schemas/task-type";
import type {
	ProgressEntry,
	TrackerDetail,
	TrackerSummary,
} from "#/schemas/tracker";
import { applyOptimistically } from "./optimistic";

/** The first page of the first stage, as a screen reads it. */
const VIEW: TaskPageView = { sort: "newest", limit: 20 };

function task(partial: Partial<Task> & { taskId: string }): Task {
	return {
		title: partial.taskId,
		completed: false,
		completedAt: null,
		trackerId: null,
		addedAt: "2026-01-01T00:00:00.000Z",
		tagIds: [],
		urgent: false,
		important: false,
		stageId: "todo",
		...partial,
	};
}

function summary(checklistId: string): ChecklistSummary {
	return {
		checklistId,
		title: checklistId,
		description: "",
		startDate: "2026-01-01",
		deadline: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		progress: { total: 1, completed: 0, percent: 0, byStage: { todo: 1 } },
	};
}

function tag(tagId: string): Tag {
	return {
		tagId,
		name: tagId,
		color: "blue",
		special: null,
		description: "",
		startDate: null,
		deadline: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};
}

/** A tag's page, counting the given tasks. */
function tagPage(tagId: string, tasks: Array<Task>): TagDetail {
	return {
		...tag(tagId),
		progress: { total: tasks.length, completed: 0, percent: 0, inProgress: 0 },
		trackers: [],
	};
}

/** A page of rows holding the whole list. */
function page<T>(items: Array<T>): Page<T> {
	return { items, total: items.length, page: 1 };
}

/** The first page of a checklist's "To do", holding the whole of it. */
function stagePage(items: Array<Task>, done = 0): StagePage {
	return {
		...page(items),
		stageId: "todo",
		counts: { todo: items.length, done },
	};
}

/** Tasks as a tag's page lists them, all from `chk_1`. */
function entries(tasks: Array<Task>): Array<TagTaskEntry> {
	return tasks.map((each) => ({
		task: each,
		checklistId: "chk_1",
		checklistTitle: "chk_1",
	}));
}

/** A client primed the way a running app's is: summaries *and* one screen. */
function client(): QueryClient {
	const queryClient = new QueryClient();

	queryClient.setQueryData<Array<ChecklistSummary>>(queryKeys.checklists, [
		summary("chk_1"),
	]);
	queryClient.setQueryData<ChecklistSummary>(
		queryKeys.checklist("chk_1"),
		summary("chk_1"),
	);
	queryClient.setQueryData<StagePage>(
		queryKeys.checklistPage("chk_1", VIEW),
		stagePage([task({ taskId: "tsk_1" })]),
	);

	return queryClient;
}

function checklist(queryClient: QueryClient) {
	return queryClient.getQueryData<ChecklistSummary>(
		queryKeys.checklist("chk_1"),
	);
}

function toDo(queryClient: QueryClient) {
	return queryClient.getQueryData<StagePage>(
		queryKeys.checklistPage("chk_1", VIEW),
	);
}

function tagTasks(queryClient: QueryClient, tagId: string) {
	return queryClient.getQueryData<Page<TagTaskEntry>>(
		queryKeys.tagOpenPage(tagId, VIEW),
	);
}

describe("applyOptimistically", () => {
	/*
	 * `["checklists"]` is the summary list's own key and the first segment of
	 * every other checklist key, so a prefix match hands back an array with no
	 * `progress` on it. Patching that as a checklist threw, which failed the
	 * mutation before it was ever sent: nothing could be changed at all.
	 */
	it("leaves the checklist summaries alone", () => {
		const queryClient = client();

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { completed: true },
		});

		expect(
			queryClient.getQueryData<Array<ChecklistSummary>>(queryKeys.checklists),
		).toEqual([summary("chk_1")]);
	});

	it("moves a ticked task to the last stage, and counts it done", () => {
		const queryClient = client();

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { completed: true },
		});

		expect(toDo(queryClient)?.items).toEqual([]);
		expect(toDo(queryClient)?.counts).toEqual({ todo: 0, done: 1 });
		expect(checklist(queryClient)?.progress).toEqual({
			total: 1,
			completed: 1,
			percent: 100,
			byStage: { todo: 0, done: 1 },
		});
	});

	it("moves a task along its stages, finishing it only at the last", () => {
		const queryClient = client();
		const stages = [
			{ stageId: "todo", name: "To do" },
			{ stageId: "review", name: "Review" },
			{ stageId: "done", name: "Done" },
		];
		queryClient.setQueryData<ChecklistSummary>(queryKeys.checklist("chk_1"), {
			...summary("chk_1"),
			stages,
		});
		queryClient.setQueryData<StagePage>(
			queryKeys.checklistPage("chk_1", VIEW),
			{
				...stagePage([task({ taskId: "tsk_1" })]),
				counts: { todo: 1, review: 0, done: 0 },
			},
		);

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { stageId: "review" },
		});

		expect(toDo(queryClient)?.items).toEqual([]);
		expect(toDo(queryClient)?.counts).toEqual({ todo: 0, review: 1, done: 0 });
		expect(checklist(queryClient)?.progress.completed).toBe(0);
	});

	/*
	 * Undoing a move along the stages: the task is at a stage whose page was
	 * never read, so no page holds it — and it still has to come back onto
	 * the one being read, at once.
	 */
	it("brings a task back to the stage being read from one never opened", () => {
		const queryClient = client();
		const stages = [
			{ stageId: "todo", name: "To do" },
			{ stageId: "review", name: "Review" },
			{ stageId: "done", name: "Done" },
		];
		queryClient.setQueryData<ChecklistSummary>(queryKeys.checklist("chk_1"), {
			...summary("chk_1"),
			stages,
		});
		queryClient.setQueryData<StagePage>(
			queryKeys.checklistPage("chk_1", VIEW),
			{
				...stagePage([task({ taskId: "tsk_1" })]),
				counts: { todo: 1, review: 0, done: 0 },
			},
		);

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { stageId: "review" },
		});
		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { stageId: "todo" },
		});

		expect(toDo(queryClient)?.items.map((each) => each.taskId)).toEqual([
			"tsk_1",
		]);
		expect(toDo(queryClient)?.counts).toEqual({ todo: 1, review: 0, done: 0 });
		expect(checklist(queryClient)?.progress.byStage).toEqual({
			todo: 1,
			review: 0,
		});
	});

	/*
	 * `["tags"]` is the tag list's key and the first segment of every tag page's,
	 * the same trap as the checklists above: the list must be left alone while
	 * the page holding the task is patched.
	 */
	it("ticks the task on a tag's page and leaves the tag list alone", () => {
		const queryClient = client();
		const tagged = task({ taskId: "tsk_1", tagIds: ["tag_1"] });

		queryClient.setQueryData<Array<Tag>>(queryKeys.tags, [tag("tag_1")]);
		queryClient.setQueryData<TagDetail>(
			queryKeys.tag("tag_1"),
			tagPage("tag_1", [tagged]),
		);
		queryClient.setQueryData(
			queryKeys.tagOpenPage("tag_1", VIEW),
			page(entries([tagged])),
		);

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { completed: true },
		});

		expect(queryClient.getQueryData<Array<Tag>>(queryKeys.tags)).toEqual([
			tag("tag_1"),
		]);
		expect(tagTasks(queryClient, "tag_1")?.items[0]?.task.completed).toBe(true);
		expect(
			queryClient.getQueryData<TagDetail>(queryKeys.tag("tag_1"))?.progress,
		).toEqual({ total: 1, completed: 1, percent: 100, inProgress: 0 });
	});

	it("counts a task on a tag's page as under way between its first stage and done", () => {
		const queryClient = client();
		const tagged = task({ taskId: "tsk_1", tagIds: ["tag_1"] });

		queryClient.setQueryData<ChecklistSummary>(queryKeys.checklist("chk_1"), {
			...summary("chk_1"),
			stages: [
				{ stageId: "todo", name: "To do" },
				{ stageId: "review", name: "Review" },
				{ stageId: "done", name: "Done" },
			],
		});
		queryClient.setQueryData<TagDetail>(
			queryKeys.tag("tag_1"),
			tagPage("tag_1", [tagged]),
		);
		queryClient.setQueryData(
			queryKeys.tagOpenPage("tag_1", VIEW),
			page(entries([tagged])),
		);
		const progress = () =>
			queryClient.getQueryData<TagDetail>(queryKeys.tag("tag_1"))?.progress;

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { stageId: "review" },
		});
		expect(progress()).toEqual({
			total: 1,
			completed: 0,
			percent: 0,
			inProgress: 1,
		});

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { completed: true },
		});
		expect(progress()).toEqual({
			total: 1,
			completed: 1,
			percent: 100,
			inProgress: 0,
		});
	});

	/*
	 * The finished tasks are read whole for the chart. Unticked, a task stays
	 * there until the refetch, but the counts have to move straight away.
	 */
	it("unticks a finished task where it is and counts it open again", () => {
		const queryClient = client();
		const done = task({ taskId: "tsk_2", completed: true, stageId: "done" });

		queryClient.setQueryData<ChecklistSummary>(queryKeys.checklist("chk_1"), {
			...summary("chk_1"),
			progress: {
				total: 2,
				completed: 1,
				percent: 50,
				byStage: { todo: 1, done: 1 },
			},
		});
		queryClient.setQueryData<Array<Task>>(
			queryKeys.checklistCompleted("chk_1"),
			[done],
		);

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_2",
			patch: { completed: false },
		});

		expect(
			queryClient.getQueryData<Array<Task>>(
				queryKeys.checklistCompleted("chk_1"),
			)?.[0]?.completed,
		).toBe(false);
		expect(checklist(queryClient)?.progress).toEqual({
			total: 2,
			completed: 0,
			percent: 0,
			byStage: { todo: 2, done: 0 },
		});
	});

	it("unticks a finished task back to the stage before done", () => {
		const queryClient = client();
		const done = task({ taskId: "tsk_2", completed: true, stageId: "done" });

		queryClient.setQueryData<ChecklistSummary>(queryKeys.checklist("chk_1"), {
			...summary("chk_1"),
			stages: [
				{ stageId: "todo", name: "To do" },
				{ stageId: "review", name: "Review" },
				{ stageId: "done", name: "Done" },
			],
		});
		queryClient.setQueryData<Array<Task>>(
			queryKeys.checklistCompleted("chk_1"),
			[done],
		);

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_2",
			patch: { completed: false },
		});

		expect(
			queryClient.getQueryData<Array<Task>>(
				queryKeys.checklistCompleted("chk_1"),
			)?.[0]?.stageId,
		).toBe("review");
	});

	it("takes a deleted task out of its checklist, and out of the count", () => {
		const queryClient = client();

		applyOptimistically(queryClient, {
			kind: "task.delete",
			taskId: "tsk_1",
		});

		expect(toDo(queryClient)?.items).toEqual([]);
		expect(toDo(queryClient)?.total).toBe(0);
		expect(toDo(queryClient)?.counts.todo).toBe(0);
	});

	it("takes a moved task out of the checklist it left", () => {
		const queryClient = client();

		applyOptimistically(queryClient, {
			kind: "task.move",
			taskId: "tsk_1",
			checklistId: "chk_2",
		});

		expect(toDo(queryClient)?.items).toEqual([]);
		expect(checklist(queryClient)?.progress).toEqual({
			total: 0,
			completed: 0,
			percent: 0,
			byStage: { todo: 0 },
		});
	});

	/*
	 * Pressing the lit bolt on Today's page takes the tag off the task, and the
	 * row should leave the page with it rather than on the refetch.
	 */
	it("drops a task from a tag's page once it no longer carries the tag", () => {
		const queryClient = client();
		const tagged = task({
			taskId: "tsk_1",
			title: "call #today",
			tagIds: ["today"],
		});

		queryClient.setQueryData<Array<Tag>>(queryKeys.tags, [tag("today")]);
		queryClient.setQueryData<TagDetail>(
			queryKeys.tag("today"),
			tagPage("today", [tagged]),
		);
		queryClient.setQueryData(
			queryKeys.tagOpenPage("today", VIEW),
			page(entries([tagged])),
		);

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { title: "call", tagIds: [] },
		});

		expect(tagTasks(queryClient, "today")?.items).toEqual([]);
		expect(
			queryClient.getQueryData<TagDetail>(queryKeys.tag("today"))?.progress,
		).toEqual({ total: 0, completed: 0, percent: 0, inProgress: 0 });
	});

	it("shows a task typed on a tag's page there at once", () => {
		const queryClient = client();

		queryClient.setQueryData<TagDetail>(
			queryKeys.tag("today"),
			tagPage("today", []),
		);
		queryClient.setQueryData(
			queryKeys.tagOpenPage("today", VIEW),
			page<TagTaskEntry>([]),
		);

		applyOptimistically(queryClient, {
			kind: "task.create",
			checklistId: null,
			taskId: "tsk_2",
			title: "call mum #today",
			addedAt: "2026-01-02T00:00:00.000Z",
			tagIds: ["today"],
			trackerId: null,
			linkedChecklistId: null,
			urgent: false,
			important: false,
		});

		const shown = tagTasks(queryClient, "today");
		expect(shown?.items.map((entry) => entry.task.taskId)).toEqual(["tsk_2"]);
		expect(shown?.items[0]?.checklistId).toBeNull();
		expect(shown?.total).toBe(1);
	});

	/*
	 * An edit sends only the tags written in the title; the server adds the
	 * checklist's back. Drawn before its answer, they must not blink off.
	 */
	it("keeps a task's checklist tags through an edit of its title", () => {
		const queryClient = client();

		queryClient.setQueryData<Array<Tag>>(queryKeys.tags, [
			tag("tag_1"),
			tag("tag_2"),
		]);
		queryClient.setQueryData(
			queryKeys.checklistPage("chk_1", VIEW),
			stagePage([
				task({
					taskId: "tsk_1",
					title: "buy milk #tag_1",
					tagIds: ["tag_1", "tag_2"],
				}),
			]),
		);

		applyOptimistically(queryClient, {
			kind: "task.update",
			taskId: "tsk_1",
			patch: { title: "buy eggs", tagIds: [] },
		});

		// The typed tag went with its text; the inherited one stayed.
		expect(toDo(queryClient)?.items[0]?.tagIds).toEqual(["tag_2"]);
	});

	it("gives a task added to a checklist that checklist's tags", () => {
		const queryClient = client();

		queryClient.setQueryData<ChecklistSummary>(queryKeys.checklist("chk_1"), {
			...summary("chk_1"),
			tagIds: ["tag_2"],
		});
		queryClient.setQueryData(
			queryKeys.checklistPage("chk_1", VIEW),
			stagePage([]),
		);

		applyOptimistically(queryClient, {
			kind: "task.create",
			checklistId: "chk_1",
			taskId: "tsk_2",
			title: "new #tag_1",
			addedAt: "2026-01-02T00:00:00.000Z",
			tagIds: ["tag_1"],
			trackerId: null,
			linkedChecklistId: null,
			urgent: false,
			important: false,
		});

		expect(toDo(queryClient)?.items[0]?.tagIds).toEqual(["tag_1", "tag_2"]);
		expect(toDo(queryClient)?.counts.todo).toBe(1);
	});
});

/* -------------------------------------------------------------------------- */
/* Whole things                                                               */
/* -------------------------------------------------------------------------- */

function tracker(partial: Partial<TrackerSummary> = {}): TrackerSummary {
	const startValue = partial.startValue ?? 0;
	const currentValue = partial.currentValue ?? startValue;
	const targetValue = partial.targetValue ?? 100;

	return {
		trackerId: "trk_1",
		title: "Dune",
		type: "book",
		description: "",
		unit: "pages",
		targetValue,
		startValue,
		currentValue,
		coverUrl: null,
		author: "",
		startDate: "2026-01-01",
		deadline: null,
		deadlineTime: null,
		tagIds: [],
		assignees: [],
		access: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		progress: {
			current: currentValue,
			target: targetValue,
			percent: Math.round(
				((currentValue - startValue) / (targetValue - startValue)) * 100,
			),
		},
		...partial,
	};
}

/** A reading as the server hands it back: its step already measured. */
function reading(
	entryId: string,
	value: number,
	recordedAt: string,
	delta: number,
): ProgressEntry {
	return {
		entryId,
		value,
		recordedAt,
		delta,
		note: "",
		recordedBy: "someone@example.com",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};
}

/** A client on a tracker's screen: the figures, the list, and the history. */
function trackerClient(
	history: Array<ProgressEntry>,
	partial: Partial<TrackerSummary> = {},
): QueryClient {
	const queryClient = new QueryClient();
	const only = tracker(partial);

	queryClient.setQueryData<TrackerDetail>(queryKeys.tracker("trk_1"), only);
	queryClient.setQueryData<Array<TrackerSummary>>(queryKeys.trackers, [only]);
	queryClient.setQueryData<Array<ProgressEntry>>(
		queryKeys.trackerEntries("trk_1"),
		history,
	);

	return queryClient;
}

const entriesOf = (queryClient: QueryClient) =>
	queryClient.getQueryData<Array<ProgressEntry>>(
		queryKeys.trackerEntries("trk_1"),
	);

const trackerOf = (queryClient: QueryClient) =>
	queryClient.getQueryData<TrackerDetail>(queryKeys.tracker("trk_1"));

const trackerList = (queryClient: QueryClient) =>
	queryClient.getQueryData<Array<TrackerSummary>>(queryKeys.trackers);

describe("applyOptimistically, on a tracker", () => {
	it("draws a new reading, its step, and where the tracker now stands", () => {
		const queryClient = trackerClient([reading("ent_1", 40, "2026-01-01", 40)]);

		applyOptimistically(queryClient, {
			kind: "entry.create",
			trackerId: "trk_1",
			entryId: "ent_2",
			value: 78,
			recordedAt: "2026-01-02",
			note: "chapter 7",
		});

		const history = entriesOf(queryClient);
		expect(history?.map((each) => each.entryId)).toEqual(["ent_1", "ent_2"]);
		// The step is measured from the reading before it, never typed.
		expect(history?.[1]?.delta).toBe(38);
		expect(trackerOf(queryClient)?.currentValue).toBe(78);
		expect(trackerOf(queryClient)?.progress.percent).toBe(78);
		// The list behind the screen moves with it.
		expect(trackerList(queryClient)?.[0]?.currentValue).toBe(78);
	});

	it("drops a back-dated reading into the history and re-spaces its neighbours", () => {
		const queryClient = trackerClient([
			reading("ent_1", 40, "2026-01-01", 40),
			reading("ent_3", 90, "2026-01-05", 50),
		]);

		applyOptimistically(queryClient, {
			kind: "entry.create",
			trackerId: "trk_1",
			entryId: "ent_2",
			value: 60,
			recordedAt: "2026-01-03",
			note: "",
		});

		const history = entriesOf(queryClient);
		expect(history?.map((each) => each.entryId)).toEqual([
			"ent_1",
			"ent_2",
			"ent_3",
		]);
		expect(history?.map((each) => each.delta)).toEqual([40, 20, 30]);
		// The latest reading is still the latest, so the tracker has not moved.
		expect(trackerOf(queryClient)?.currentValue).toBe(90);
	});

	it("takes a reading out and hands its step to the one after it", () => {
		const queryClient = trackerClient([
			reading("ent_1", 40, "2026-01-01", 40),
			reading("ent_2", 60, "2026-01-03", 20),
			reading("ent_3", 90, "2026-01-05", 30),
		]);

		applyOptimistically(queryClient, {
			kind: "entry.delete",
			trackerId: "trk_1",
			entryId: "ent_2",
		});

		expect(entriesOf(queryClient)?.map((each) => each.delta)).toEqual([40, 50]);
		expect(trackerOf(queryClient)?.currentValue).toBe(90);
	});

	it("corrects the latest reading and brings the tracker back with it", () => {
		const queryClient = trackerClient([
			reading("ent_1", 40, "2026-01-01", 40),
			reading("ent_2", 90, "2026-01-05", 50),
		]);

		applyOptimistically(queryClient, {
			kind: "entry.update",
			trackerId: "trk_1",
			entryId: "ent_2",
			patch: { value: 70 },
		});

		expect(entriesOf(queryClient)?.[1]?.delta).toBe(30);
		expect(trackerOf(queryClient)?.currentValue).toBe(70);
	});

	/*
	 * A step measured against readings this browser has not seen would be a
	 * number made up; the read already running brings the real one.
	 */
	it("leaves the figures alone while the history is still on its way", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData<TrackerDetail>(
			queryKeys.tracker("trk_1"),
			tracker({ currentValue: 40 }),
		);

		applyOptimistically(queryClient, {
			kind: "entry.create",
			trackerId: "trk_1",
			entryId: "ent_2",
			value: 78,
			recordedAt: "2026-01-02",
			note: "",
		});

		expect(trackerOf(queryClient)?.currentValue).toBe(40);
	});

	it("moves the percentage when the target moves, and not where it stands", () => {
		const queryClient = trackerClient([], { currentValue: 50 });

		applyOptimistically(queryClient, {
			kind: "tracker.update",
			trackerId: "trk_1",
			patch: { targetValue: 200 },
		});

		expect(trackerOf(queryClient)?.currentValue).toBe(50);
		expect(trackerOf(queryClient)?.progress.percent).toBe(25);
	});

	it("takes a deleted tracker off the list at once", () => {
		const queryClient = trackerClient([]);

		applyOptimistically(queryClient, {
			kind: "tracker.delete",
			trackerId: "trk_1",
		});

		expect(trackerList(queryClient)).toEqual([]);
	});

	it("puts a new tracker on the list with an empty history", () => {
		const queryClient = trackerClient([], { trackerId: "trk_other" });

		applyOptimistically(queryClient, {
			kind: "tracker.create",
			trackerId: "trk_2",
			title: "Sapiens",
			caption: "",
			type: "book",
			unit: "pages",
			targetValue: 400,
			startValue: 40,
			startDate: "2026-02-01",
			deadline: null,
			deadlineTime: null,
			description: "",
			coverUrl: null,
			author: "",
			tagIds: [],
			assignees: [],
			access: null,
		});

		const list = trackerList(queryClient);
		expect(list?.map((each) => each.trackerId)).toEqual(["trk_other", "trk_2"]);
		// It stands where it starts, so it is 0% of the way and not 10%.
		expect(list?.[1]?.currentValue).toBe(40);
		expect(list?.[1]?.progress.percent).toBe(0);
		expect(
			queryClient.getQueryData<Array<ProgressEntry>>(
				queryKeys.trackerEntries("trk_2"),
			),
		).toEqual([]);
	});
});

describe("applyOptimistically, on the rest", () => {
	const checklists = (queryClient: QueryClient) =>
		queryClient.getQueryData<Array<ChecklistSummary>>(queryKeys.checklists);

	it("renames a checklist on its own screen and on its card", () => {
		const queryClient = client();

		applyOptimistically(queryClient, {
			kind: "checklist.update",
			checklistId: "chk_1",
			patch: { title: "Renamed" },
		});

		expect(checklist(queryClient)?.title).toBe("Renamed");
		expect(checklists(queryClient)?.map((each) => each.title)).toEqual([
			"Renamed",
		]);
	});

	it("takes a deleted checklist off the list", () => {
		const queryClient = client();

		applyOptimistically(queryClient, {
			kind: "checklist.delete",
			checklistId: "chk_1",
		});

		expect(checklists(queryClient)).toEqual([]);
	});

	it("takes a deleted checklist's tasks off a tag's page with it", () => {
		const queryClient = client();
		const tasks = [task({ taskId: "tsk_1", tagIds: ["tag_1"] })];
		queryClient.setQueryData<TagDetail>(
			queryKeys.tag("tag_1"),
			tagPage("tag_1", tasks),
		);
		queryClient.setQueryData<Page<TagTaskEntry>>(
			queryKeys.tagOpenPage("tag_1", VIEW),
			page(entries(tasks)),
		);

		applyOptimistically(queryClient, {
			kind: "checklist.delete",
			checklistId: "chk_1",
		});

		expect(tagTasks(queryClient, "tag_1")?.items).toEqual([]);
		expect(
			queryClient.getQueryData<TagDetail>(queryKeys.tag("tag_1"))?.progress
				.total,
		).toBe(0);
	});

	/*
	 * A tag is usually born mid-sentence, as `#name` typed into a task: the chip
	 * on that row is looked up in this list, so without the tag on it the task
	 * read as having lost the tag that had just been typed.
	 */
	it("draws a tag the moment it is made", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData<Array<Tag>>(queryKeys.tags, [tag("tag_1")]);

		applyOptimistically(queryClient, {
			kind: "tag.create",
			tagId: "tag_2",
			name: "deep-work",
			color: "indigo",
			description: "",
			startDate: null,
			deadline: null,
			deadlineTime: null,
			dailyWindow: null,
			access: null,
		});

		const tags = queryClient.getQueryData<Array<Tag>>(queryKeys.tags);
		expect(tags?.map((each) => each.name)).toEqual(["tag_1", "deep-work"]);
		expect(tags?.[1]?.color).toBe("indigo");
	});

	it("recolours a tag on the list and on its own page together", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData<Array<Tag>>(queryKeys.tags, [tag("tag_1")]);
		queryClient.setQueryData<TagDetail>(
			queryKeys.tag("tag_1"),
			tagPage("tag_1", []),
		);

		applyOptimistically(queryClient, {
			kind: "tag.update",
			tagId: "tag_1",
			patch: { color: "lime" },
		});

		expect(
			queryClient.getQueryData<Array<Tag>>(queryKeys.tags)?.[0]?.color,
		).toBe("lime");
		expect(
			queryClient.getQueryData<TagDetail>(queryKeys.tag("tag_1"))?.color,
		).toBe("lime");
	});

	it("takes a deleted tag off the list, which takes its chips off the rows", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData<Array<Tag>>(queryKeys.tags, [
			tag("tag_1"),
			tag("tag_2"),
		]);

		applyOptimistically(queryClient, { kind: "tag.delete", tagId: "tag_1" });

		expect(
			queryClient
				.getQueryData<Array<Tag>>(queryKeys.tags)
				?.map((each) => each.tagId),
		).toEqual(["tag_2"]);
	});

	it("draws a plan made, edited and deleted, newest-changed first", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData<Array<PlanSummary>>(queryKeys.plans, [
			{
				planId: "pln_1",
				title: "Old",
				length: 3,
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:00.000Z",
			},
		]);

		applyOptimistically(queryClient, {
			kind: "plan.create",
			planId: "pln_2",
			title: "Roadmap",
			body: "# Roadmap",
		});
		applyOptimistically(queryClient, {
			kind: "plan.update",
			planId: "pln_1",
			patch: { body: "longer body" },
		});

		const plans = () =>
			queryClient.getQueryData<Array<PlanSummary>>(queryKeys.plans);
		expect(plans()?.map((each) => [each.planId, each.length])).toEqual([
			["pln_1", 11],
			["pln_2", 9],
		]);
		expect(queryClient.getQueryData<Plan>(queryKeys.plan("pln_2"))?.body).toBe(
			"# Roadmap",
		);

		applyOptimistically(queryClient, { kind: "plan.delete", planId: "pln_1" });
		expect(plans()?.map((each) => each.planId)).toEqual(["pln_2"]);
	});

	it("sets, moves and takes away a reminder at once", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData<Array<Reminder>>(queryKeys.reminders, [
			{ target: "day", targetId: null, time: "08:00" },
		]);
		const change = {
			kind: "reminder.set" as const,
			target: "checklist" as const,
			targetId: "chk_1",
			timeZone: "UTC",
		};
		const reminders = () =>
			queryClient.getQueryData<Array<Reminder>>(queryKeys.reminders);

		applyOptimistically(queryClient, { ...change, time: "18:00" });
		applyOptimistically(queryClient, { ...change, time: "19:30" });
		expect(reminders()?.map((each) => each.time)).toEqual(["08:00", "19:30"]);

		applyOptimistically(queryClient, { ...change, time: null });
		expect(reminders()?.map((each) => each.target)).toEqual(["day"]);
	});

	it("lays a list out again at once, leaving the others as they were", () => {
		const queryClient = new QueryClient();
		const tags = { order: ["tag_1"], groups: [] };
		queryClient.setQueryData<Arrangements>(queryKeys.arrangements, { tags });

		const checklists = {
			order: ["chk_2", "chk_1"],
			groups: [{ groupId: "grp_1", name: "Work", itemIds: ["chk_2"] }],
		};
		applyOptimistically(queryClient, {
			kind: "arrangement.set",
			list: "checklists",
			arrangement: checklists,
		});

		expect(
			queryClient.getQueryData<Arrangements>(queryKeys.arrangements),
		).toEqual({ tags, checklists });
	});

	it("rewrites the space's task types at once", () => {
		const queryClient = new QueryClient();
		const types: Array<TaskType> = [
			{ typeId: "bug", name: "Defect", color: "rose" },
		];
		queryClient.setQueryData<Array<TaskType>>(queryKeys.taskTypes, [
			{ typeId: "bug", name: "Bug", color: "red" },
		]);

		applyOptimistically(queryClient, { kind: "taskTypes.set", types });

		expect(
			queryClient.getQueryData<Array<TaskType>>(queryKeys.taskTypes),
		).toEqual(types);
	});
});

describe("applyOptimistically, moving a task", () => {
	/** Two checklists, the task in the first, both pages on screen. */
	function moving(): QueryClient {
		const queryClient = new QueryClient();
		const from = { ...summary("chk_1"), tagIds: ["tag_1"] };
		const to = { ...summary("chk_2"), tagIds: ["tag_2"] };

		queryClient.setQueryData<Array<ChecklistSummary>>(queryKeys.checklists, [
			from,
			to,
		]);
		queryClient.setQueryData<ChecklistSummary>(
			queryKeys.checklist("chk_1"),
			from,
		);
		queryClient.setQueryData<ChecklistSummary>(queryKeys.checklist("chk_2"), {
			...to,
			progress: { total: 0, completed: 0, percent: 0, byStage: {} },
		});
		queryClient.setQueryData<StagePage>(
			queryKeys.checklistPage("chk_1", VIEW),
			stagePage([task({ taskId: "tsk_1", tagIds: ["tag_1", "tag_3"] })]),
		);
		queryClient.setQueryData<StagePage>(
			queryKeys.checklistPage("chk_2", VIEW),
			stagePage([]),
		);
		queryClient.setQueryData<Array<Tag>>(queryKeys.tags, [
			tag("tag_1"),
			tag("tag_2"),
			tag("tag_3"),
		]);
		return queryClient;
	}

	const pageOf = (queryClient: QueryClient, checklistId: string) =>
		queryClient.getQueryData<StagePage>(
			queryKeys.checklistPage(checklistId, VIEW),
		);

	/*
	 * It used only to leave, so moving a task made it disappear until the
	 * refetch — and undoing a move made it disappear a second time.
	 */
	it("takes it off the list it left and puts it on the one it joined", () => {
		const queryClient = moving();

		applyOptimistically(queryClient, {
			kind: "task.move",
			taskId: "tsk_1",
			checklistId: "chk_2",
		});

		expect(pageOf(queryClient, "chk_1")?.items).toEqual([]);
		expect(
			pageOf(queryClient, "chk_2")?.items.map((each) => each.taskId),
		).toEqual(["tsk_1"]);
		expect(pageOf(queryClient, "chk_2")?.counts.todo).toBe(1);
		expect(
			queryClient.getQueryData<ChecklistSummary>(queryKeys.checklist("chk_2"))
				?.progress.total,
		).toBe(1);
		expect(
			queryClient.getQueryData<ChecklistSummary>(queryKeys.checklist("chk_1"))
				?.progress.total,
		).toBe(0);
	});

	/*
	 * A task carries its checklist's tags. `tag_1` came from the list it is
	 * leaving and nobody wrote it, so it goes; `tag_3` is its own and stays.
	 */
	it("swaps the tags it had from the old list for the new list's", () => {
		const queryClient = moving();

		applyOptimistically(queryClient, {
			kind: "task.move",
			taskId: "tsk_1",
			checklistId: "chk_2",
		});

		expect(pageOf(queryClient, "chk_2")?.items[0]?.tagIds).toEqual([
			"tag_3",
			"tag_2",
		]);
	});

	it("keeps a tag the title wrote, whichever list it was from", () => {
		const queryClient = moving();
		queryClient.setQueryData<StagePage>(
			queryKeys.checklistPage("chk_1", VIEW),
			stagePage([
				task({
					taskId: "tsk_1",
					title: "read the spec #tag_1",
					tagIds: ["tag_1"],
				}),
			]),
		);

		applyOptimistically(queryClient, {
			kind: "task.move",
			taskId: "tsk_1",
			checklistId: "chk_2",
		});

		expect(pageOf(queryClient, "chk_2")?.items[0]?.tagIds).toEqual([
			"tag_1",
			"tag_2",
		]);
	});
});
