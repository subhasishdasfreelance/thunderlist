import type { TaskFilter, TaskPageView } from "#/schemas/task";

/** Query keys, in one place so a confirmed batch can invalidate precisely. */
export const queryKeys = {
	setupStatus: ["setup-status"] as const,
	/** Who is signed in; see `sessionQuery`. */
	session: ["session"] as const,
	/** Where the app is working, and who is in the team; see `spaceQuery`. */
	space: ["space"] as const,
	/** Every team this person is in, with its people; see `teamsQuery`. */
	teams: ["teams"] as const,
	/** The space's task types; see `taskTypesQuery`. */
	taskTypes: ["task-types"] as const,
	searchIndex: ["search-index"] as const,
	checklists: ["checklists"] as const,
	checklist: (checklistId: string) => ["checklists", checklistId] as const,
	/**
	 * A checklist's figures counting only what a filter lets through; see
	 * `taskFilterSchema`. Apart from the checklist's own key, which the screen
	 * patches as tasks are ticked.
	 */
	checklistFiltered: (checklistId: string, filter: TaskFilter) =>
		["checklists", checklistId, "filtered", filter] as const,
	/** A checklist's tasks, a stage and a page at a time, all under one key. */
	checklistPages: (checklistId: string) =>
		["checklists", checklistId, "pages"] as const,
	/** One page of one stage; see `getChecklistStageTasks`. */
	checklistPage: (checklistId: string, view: TaskPageView) =>
		["checklists", checklistId, "pages", view] as const,
	/** A checklist's finished tasks, read for its chart and for clearing them. */
	checklistCompleted: (checklistId: string) =>
		["checklists", checklistId, "completed"] as const,
	trackers: ["trackers"] as const,
	tracker: (trackerId: string) => ["trackers", trackerId] as const,
	/** The history, read after the figures rather than with them. */
	trackerEntries: (trackerId: string) =>
		["trackers", trackerId, "entries"] as const,
	tags: ["tags"] as const,
	tag: (tagId: string) => ["tags", tagId] as const,
	/** A tag's figures, counting only what a filter lets through; see
	 * `checklistFiltered`. */
	tagFor: (tagId: string, filter: TaskFilter) =>
		["tags", tagId, "filtered", filter] as const,
	/** A tag's open tasks: every page of them read, under one key. */
	tagOpen: (tagId: string) => ["tags", tagId, "open"] as const,
	/** One page of them, in one order; see `getTagOpenTasks`. */
	tagOpenPage: (tagId: string, view: TaskPageView) =>
		["tags", tagId, "open", view] as const,
	/** A tag's finished tasks, read once their section is opened. */
	tagCompleted: (tagId: string) => ["tags", tagId, "completed"] as const,
	/** The tags with their progress, which only the Tags screen reads. */
	tagSummaries: ["tag-summaries"] as const,
};
