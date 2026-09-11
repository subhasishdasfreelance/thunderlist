/** Query keys, in one place so a confirmed batch can invalidate precisely. */
export const queryKeys = {
	setupStatus: ["setup-status"] as const,
	/** Who is signed in; see `sessionQuery`. */
	session: ["session"] as const,
	searchIndex: ["search-index"] as const,
	checklists: ["checklists"] as const,
	checklist: (checklistId: string) => ["checklists", checklistId] as const,
	/** A checklist's finished tasks, read after the rest of its screen. */
	checklistCompleted: (checklistId: string) =>
		["checklists", checklistId, "completed"] as const,
	trackers: ["trackers"] as const,
	tracker: (trackerId: string) => ["trackers", trackerId] as const,
	/** The history, read after the figures rather than with them. */
	trackerEntries: (trackerId: string) =>
		["trackers", trackerId, "entries"] as const,
	tags: ["tags"] as const,
	tag: (tagId: string) => ["tags", tagId] as const,
	/** A tag's finished tasks, read after the rest of its screen. */
	tagCompleted: (tagId: string) => ["tags", tagId, "completed"] as const,
	/** The tags with their progress, which only the Tags screen reads. */
	tagSummaries: ["tag-summaries"] as const,
};
