/** Query keys, in one place so a confirmed batch can invalidate precisely. */
export const queryKeys = {
	setupStatus: ["setup-status"] as const,
	searchIndex: ["search-index"] as const,
	/** Today and Backlog are fetched together, so they share one key. */
	taskLists: ["task-lists"] as const,
	checklists: ["checklists"] as const,
	checklist: (checklistId: string) => ["checklists", checklistId] as const,
	trackers: ["trackers"] as const,
	tracker: (trackerId: string) => ["trackers", trackerId] as const,
	tags: ["tags"] as const,
};
