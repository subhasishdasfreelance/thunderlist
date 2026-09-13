import { describe, expect, it } from "bun:test";
import {
	type Hidden,
	isTaskVisible,
	NOTHING_HIDDEN,
} from "./visibility.server";

const hidden: Hidden = {
	checklistIds: new Set(["chk_private"]),
	tagIds: new Set(["tag_private"]),
	trackerIds: new Set(),
	inboxId: "chk_inbox",
};

describe("isTaskVisible", () => {
	it("goes by the checklist a task lives in", () => {
		expect(
			isTaskVisible({ checklistId: "chk_private", tagIds: [] }, hidden),
		).toBe(false);
		// A kept tag does not hide a task whose checklist can be seen.
		expect(
			isTaskVisible(
				{ checklistId: "chk_open", tagIds: ["tag_private"] },
				hidden,
			),
		).toBe(true);
	});

	it("shows a task in no checklist while any of its tags can be seen", () => {
		expect(
			isTaskVisible({ checklistId: null, tagIds: ["tag_private"] }, hidden),
		).toBe(false);
		expect(
			isTaskVisible(
				{ checklistId: null, tagIds: ["tag_private", "tag_today"] },
				hidden,
			),
		).toBe(true);
		expect(isTaskVisible({ checklistId: null, tagIds: [] }, hidden)).toBe(true);
	});

	/*
	 * The Inbox holds what belongs to no other checklist — a task typed onto a
	 * kept tag's page lands there — so it cannot be the thing that decides:
	 * everyone sees the Inbox, and a task in it would be shown to all of them.
	 */
	it("sees a task in the Inbox by its tags, as one in no checklist", () => {
		expect(
			isTaskVisible(
				{ checklistId: "chk_inbox", tagIds: ["tag_private"] },
				hidden,
			),
		).toBe(false);
		expect(
			isTaskVisible({ checklistId: "chk_inbox", tagIds: [] }, hidden),
		).toBe(true);
	});

	it("hides nothing when nothing is kept from this person", () => {
		expect(
			isTaskVisible(
				{ checklistId: "chk_private", tagIds: ["tag_private"] },
				NOTHING_HIDDEN,
			),
		).toBe(true);
	});
});
