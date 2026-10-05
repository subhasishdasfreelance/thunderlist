/**
 * Pictures on tasks, checklists, trackers and tags, as the browser handles
 * them.
 *
 * Adding or removing one is saved on its own, the moment it happens, not with
 * the dialog it is done in. A picture picked is drawn at once from the device,
 * with a bar for how far it has got, and once it has been sent and made smaller
 * — see `imageRouter` — it goes on its item as any edit does: drawn first,
 * saved after. Removing one is an edit the same way, and the server deletes the
 * file once nothing shows it; see `imagesAtRisk`.
 *
 * What is on its way is kept here rather than in the dialog, so it carries on
 * when the dialog is closed, and is shown again when it is opened.
 */

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { generateReactHelpers } from "@uploadthing/react";
import { useCallback, useRef, useSyncExternalStore } from "react";
import type { ImageKind, ImageRouter } from "#/data/images.server";
import { findCachedTask } from "#/lib/optimistic";
import { queryKeys } from "#/queries/keys";
import type { Change } from "#/schemas/change";
import type { ChecklistSummary } from "#/schemas/checklist";
import type { ImageRef } from "#/schemas/common";
import type { Tag, TagDetail } from "#/schemas/tag";
import type { TrackerDetail, TrackerSummary } from "#/schemas/tracker";

const { uploadFiles } = generateReactHelpers<ImageRouter>({
	url: "/api/uploadthing",
});

/**
 * A picture on its way, drawn from the device. `progress` is how much of it
 * has been sent, out of 100; at 100 it is being made smaller.
 */
export type PendingImage = { key: string; preview: string; progress: number };

const NO_PENDING: Array<PendingImage> = [];
const NO_IMAGES: Array<ImageRef> = [];

/** What is on its way, by item; see `itemKey`. */
const pending = new Map<string, Array<PendingImage>>();
const listeners = new Set<() => void>();

function itemKey(kind: ImageKind, itemId: string): string {
	return `${kind}/${itemId}`;
}

function setPending(
	key: string,
	update: (all: Array<PendingImage>) => Array<PendingImage>,
): void {
	const next = update(pending.get(key) ?? NO_PENDING);
	if (next.length === 0) pending.delete(key);
	else pending.set(key, next);
	for (const listener of listeners) listener();
}

function subscribePending(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/** The pictures on their way to this item. */
export function usePendingImages(
	kind: ImageKind,
	itemId: string,
): ReadonlyArray<PendingImage> {
	const key = itemKey(kind, itemId);
	return useSyncExternalStore(
		subscribePending,
		() => pending.get(key) ?? NO_PENDING,
		() => NO_PENDING,
	);
}

/** The pictures on an item as this browser draws it, or none if it has none. */
function currentImages(
	client: QueryClient,
	kind: ImageKind,
	itemId: string,
): Array<ImageRef> {
	switch (kind) {
		case "tasks":
			return findCachedTask(client, itemId)?.task.images ?? NO_IMAGES;
		case "checklists":
			return (
				(
					client.getQueryData<ChecklistSummary>(queryKeys.checklist(itemId)) ??
					client
						.getQueryData<Array<ChecklistSummary>>(queryKeys.checklists)
						?.find((each) => each.checklistId === itemId)
				)?.images ?? NO_IMAGES
			);
		case "trackers":
			return (
				(
					client.getQueryData<TrackerDetail>(queryKeys.tracker(itemId)) ??
					client
						.getQueryData<Array<TrackerSummary>>(queryKeys.trackers)
						?.find((each) => each.trackerId === itemId)
				)?.images ?? NO_IMAGES
			);
		case "tags":
			return (
				(
					client.getQueryData<TagDetail>(queryKeys.tag(itemId)) ??
					client
						.getQueryData<Array<Tag>>(queryKeys.tags)
						?.find((each) => each.tagId === itemId)
				)?.images ?? NO_IMAGES
			);
	}
}

/** The pictures on an item, followed as they change. */
export function useImages(
	kind: ImageKind,
	itemId: string,
): ReadonlyArray<ImageRef> {
	const client = useQueryClient();
	const last = useRef(NO_IMAGES);
	const subscribe = useCallback(
		(listener: () => void) => client.getQueryCache().subscribe(listener),
		[client],
	);
	// The same list for the same pictures, so nothing is drawn again for a
	// cache change that did not touch them.
	const read = () => {
		const now = currentImages(client, kind, itemId);
		if (JSON.stringify(now) !== JSON.stringify(last.current)) {
			last.current = now;
		}
		return last.current;
	};
	return useSyncExternalStore(subscribe, read, () => last.current);
}

/** The edit that gives an item this list of pictures. */
function withImages(
	kind: ImageKind,
	itemId: string,
	images: Array<ImageRef>,
): Change {
	switch (kind) {
		case "tasks":
			return { kind: "task.update", taskId: itemId, patch: { images } };
		case "checklists":
			return {
				kind: "checklist.update",
				checklistId: itemId,
				patch: { images },
			};
		case "trackers":
			return { kind: "tracker.update", trackerId: itemId, patch: { images } };
		case "tags":
			return { kind: "tag.update", tagId: itemId, patch: { images } };
	}
}

/**
 * Send one picture to be made smaller and kept, then put it on its item.
 * Resolves once it is on, or rejects saying why it is not.
 */
export async function addImage(
	client: QueryClient,
	apply: (change: Change) => void,
	kind: ImageKind,
	itemId: string,
	file: File,
): Promise<void> {
	const key = itemKey(kind, itemId);
	const mine = crypto.randomUUID();
	const preview = URL.createObjectURL(file);
	const track = (progress: number) =>
		setPending(key, (all) =>
			all.map((each) => (each.key === mine ? { ...each, progress } : each)),
		);
	setPending(key, (all) => [...all, { key: mine, preview, progress: 0 }]);

	try {
		const [uploaded] = await uploadFiles("image", {
			files: [file],
			input: { kind, itemId },
			onUploadProgress: ({ progress }) => track(Math.round(progress)),
		});
		const answer = uploaded?.serverData;
		if (!answer) throw new Error("That picture could not be saved.");
		if ("error" in answer) throw new Error(answer.error);

		// Onto the list as it is now: others may have arrived since this began.
		apply(
			withImages(kind, itemId, [
				...currentImages(client, kind, itemId),
				answer,
			]),
		);
	} finally {
		setPending(key, (all) => all.filter((each) => each.key !== mine));
		URL.revokeObjectURL(preview);
	}
}

/** Take a picture off its item; the server deletes the file after. */
export function removeImage(
	client: QueryClient,
	apply: (change: Change) => void,
	kind: ImageKind,
	itemId: string,
	imageId: string,
): void {
	apply(
		withImages(
			kind,
			itemId,
			currentImages(client, kind, itemId).filter(
				(image) => image.id !== imageId,
			),
		),
	);
}
