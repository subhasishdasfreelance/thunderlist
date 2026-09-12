import type { TaskPageView } from "#/schemas/task";

/** Query keys, in one place so a confirmed batch can invalidate precisely. */
export const queryKeys = {
	setupStatus: ["setup-status"] as const,
	/** Who is signed in; see `sessionQuery`. */
	session: ["session"] as const,
	searchIndex: ["search-index"] as const,
	checklists: ["checklists"] as const,
	checklist: (checklistId: string) => ["checklists", checklistId] as const,
	/** A checklist's open tasks: every page of them read, under one key. */
	checklistOpen: (checklistId: string) =>
		["checklists", checklistId, "open"] as const,
	/** One page of them, in one order; see `getChecklistOpenTasks`. */
	checklistOpenPage: (checklistId: string, view: TaskPageView) =>
		["checklists", checklistId, "open", view] as const,
	/** A checklist's finished tasks, read once their section is opened. */
	checklistCompleted: (checklistId: string) =>
		["checklists", checklistId, "completed"] as const,
	trackers: ["trackers"] as const,
	tracker: (trackerId: string) => ["trackers", trackerId] as const,
	/** The history, read after the figures rather than with them. */
	trackerEntries: (trackerId: string) =>
		["trackers", trackerId, "entries"] as const,
	tags: ["tags"] as const,
	tag: (tagId: string) => ["tags", tagId] as const,
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
