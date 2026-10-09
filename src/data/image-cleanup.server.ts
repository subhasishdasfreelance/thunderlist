/**
 * Deleting pictures from UploadThing once nothing shows them. Server only.
 *
 * Works as tags do; see `deleteUnusedTags`. Before a change is applied, the
 * pictures it may leave on nothing are read — those of what it deletes, those
 * of what it gives a new list of pictures to, and those of the tags it may
 * take off their last thing. After it, whichever of them nothing carries any
 * more are deleted. Asking afterwards, rather than deleting what the change
 * names, is what keeps a picture that is still somewhere else, and copes with
 * a batch refused part way.
 *
 * The browser has long since drawn the change by then, so this is never
 * waited on by anyone looking, and a failure here never fails the change: it
 * is reported, and the files are only left behind.
 */

import { UTApi } from "uploadthing/server";
import { collections } from "#/lib/mongo/client.server";
import type { Change } from "#/schemas/change";
import type { ImageRef } from "#/schemas/common";
import { reportError } from "./error-report.server";

const utapi = new UTApi();

const IMAGES = { _id: 0, images: 1 } as const;

function idsOf(
	found: ReadonlyArray<{ images?: ReadonlyArray<ImageRef> }>,
): Array<string> {
	return found.flatMap((each) => (each.images ?? []).map((image) => image.id));
}

/**
 * The pictures a change may leave on nothing; see the top of this file.
 * `tagIds` are the tags it may leave on nothing; see `tagsAtRisk`.
 */
export async function imagesAtRisk(
	userId: string,
	change: Change,
	tagIds: ReadonlyArray<string>,
): Promise<Array<string>> {
	const taskIds: Array<string> = [];
	const checklistIds: Array<string> = [];
	// Deleted, so their tasks go with them.
	const goneChecklistIds: Array<string> = [];
	const trackerIds: Array<string> = [];
	const allTagIds = [...tagIds];

	switch (change.kind) {
		case "task.update":
			if (change.patch.images !== undefined) taskIds.push(change.taskId);
			break;
		case "task.delete":
			taskIds.push(change.taskId);
			break;
		case "task.deleteMany":
			taskIds.push(...change.taskIds);
			break;
		case "task.batch":
			for (const each of change.changes) {
				if (each.kind === "task.update" && each.patch.images !== undefined) {
					taskIds.push(each.taskId);
				}
			}
			break;
		case "checklist.update":
			if (change.patch.images !== undefined) {
				checklistIds.push(change.checklistId);
			}
			break;
		case "checklist.delete":
			goneChecklistIds.push(change.checklistId);
			break;
		case "tracker.update":
			if (change.patch.images !== undefined) trackerIds.push(change.trackerId);
			break;
		case "tracker.delete":
			trackerIds.push(change.trackerId);
			break;
		case "tag.update":
			if (change.patch.images !== undefined) allTagIds.push(change.tagId);
			break;
		case "tag.delete":
			allTagIds.push(change.tagId);
			break;
		case "items.delete":
			for (const item of change.items) {
				if (item.kind === "checklist") goneChecklistIds.push(item.id);
				if (item.kind === "tracker") trackerIds.push(item.id);
				if (item.kind === "tag") allTagIds.push(item.id);
			}
			break;
	}

	const allChecklistIds = [...checklistIds, ...goneChecklistIds];
	if (
		taskIds.length + allChecklistIds.length + trackerIds.length === 0 &&
		allTagIds.length === 0
	) {
		return [];
	}

	const current = await collections();
	const found = await Promise.all([
		taskIds.length === 0
			? []
			: current.tasks
					.find({ userId, taskId: { $in: taskIds } }, { projection: IMAGES })
					.toArray(),
		allChecklistIds.length === 0
			? []
			: current.checklists
					.find(
						{ userId, checklistId: { $in: allChecklistIds } },
						{ projection: IMAGES },
					)
					.toArray(),
		goneChecklistIds.length === 0
			? []
			: current.tasks
					.find(
						{ userId, checklistId: { $in: goneChecklistIds } },
						{ projection: IMAGES },
					)
					.toArray(),
		trackerIds.length === 0
			? []
			: current.trackers
					.find(
						{ userId, trackerId: { $in: trackerIds } },
						{ projection: IMAGES },
					)
					.toArray(),
		allTagIds.length === 0
			? []
			: current.tags
					.find({ userId, tagId: { $in: allTagIds } }, { projection: IMAGES })
					.toArray(),
	]);
	return found.flatMap(idsOf);
}

/** Delete whichever of these pictures nothing carries any more. */
export async function deleteUnusedImages(
	userId: string,
	imageIds: ReadonlyArray<string>,
): Promise<void> {
	if (imageIds.length === 0) return;

	try {
		const current = await collections();
		const carried = { userId, "images.id": { $in: [...imageIds] } };
		const kept = await Promise.all([
			current.tasks.find(carried, { projection: IMAGES }).toArray(),
			current.checklists.find(carried, { projection: IMAGES }).toArray(),
			current.trackers.find(carried, { projection: IMAGES }).toArray(),
			current.tags.find(carried, { projection: IMAGES }).toArray(),
		]);
		const stillShown = new Set(kept.flatMap(idsOf));
		const unused = imageIds.filter((id) => !stillShown.has(id));
		if (unused.length === 0) return;

		await utapi.deleteFiles(unused, { keyType: "customId" });
	} catch (error) {
		console.error("[thunderlist] deleting pictures failed:", error);
		await reportError("deleting pictures", error);
	}
}
