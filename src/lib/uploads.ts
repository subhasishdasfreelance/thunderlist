/**
 * Pictures on tasks, checklists, trackers and tags, as the browser handles
 * them.
 *
 * A dialog edits a thing's pictures as it edits the rest of it: a picture
 * picked is sent at once — drawn from the device, with a bar for how far it
 * has got — but goes on the thing only when the dialog is saved, and a picture
 * taken off, or made the cover, is only that once it is saved too. Cancelled,
 * the pictures sent meanwhile are thrown away; see `useImageDraft`.
 *
 * Saved while a picture is still on its way, the picture carries on after the
 * dialog has closed and goes on the thing once it arrives, as any edit does:
 * drawn first, saved after. What is on its way is kept here rather than in the
 * dialog for that reason, and so a dialog opened again shows it.
 */

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { generateReactHelpers } from "@uploadthing/react";
import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type { ImageKind, ImageRouter } from "#/data/images.server";
import { discardImagesFn } from "#/functions/images.functions";
import { type ApplyChange, useApplyChange } from "#/lib/changes";
import { errorMessage } from "#/lib/errors";
import { findCachedTask } from "#/lib/optimistic";
import { useToast } from "#/lib/toasts";
import { queryKeys } from "#/queries/keys";
import type { Change } from "#/schemas/change";
import type { ChecklistSummary } from "#/schemas/checklist";
import { type ImageRef, MAX_IMAGES } from "#/schemas/common";
import type { Tag, TagDetail } from "#/schemas/tag";
import type { TrackerDetail, TrackerSummary } from "#/schemas/tracker";

const { uploadFiles } = generateReactHelpers<ImageRouter>({
	url: "/api/uploadthing",
});

/**
 * What becomes of a picture once it arrives: back to the dialog it was picked
 * in, onto its thing — the dialog was saved — or thrown away, the dialog was
 * cancelled.
 */
type Fate = "draft" | "attach" | "discard";

/**
 * A picture on its way, drawn from the device. `progress` runs from 0 to 100
 * and only ever forward; `image` is where it is kept, once it is.
 */
export type Upload = {
	key: string;
	item: string;
	preview: string;
	progress: number;
	fate: Fate;
	image: ImageRef | null;
};

/**
 * How much of the bar is the picture being sent, measured in bytes. The rest
 * is the server making it smaller, which says nothing until it is done, so
 * that part moves on an estimate from its size, slowing as it nears the end,
 * and fills once it is.
 */
const SENDING_SHARE = 85;

function makingSmallerMs(bytes: number): number {
	return 1500 + (bytes / 1_000_000) * 700;
}

const NO_UPLOADS: ReadonlyArray<Upload> = [];
const NO_IMAGES: Array<ImageRef> = [];

const uploads = new Map<string, Upload>();
let everyUpload: ReadonlyArray<Upload> = NO_UPLOADS;
const listeners = new Set<() => void>();

function changed(): void {
	everyUpload = [...uploads.values()];
	for (const listener of listeners) listener();
}

function update(key: string, patch: Partial<Upload>): void {
	const upload = uploads.get(key);
	if (upload === undefined) return;
	uploads.set(key, { ...upload, ...patch });
	changed();
}

function drop(key: string): void {
	const upload = uploads.get(key);
	if (upload === undefined) return;
	URL.revokeObjectURL(upload.preview);
	uploads.delete(key);
	changed();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function useUploads(): ReadonlyArray<Upload> {
	return useSyncExternalStore(
		subscribe,
		() => everyUpload,
		() => NO_UPLOADS,
	);
}

function itemKey(kind: ImageKind, itemId: string): string {
	return `${kind}/${itemId}`;
}

function discard(ids: ReadonlyArray<string>): void {
	if (ids.length === 0) return;
	discardImagesFn({ data: { ids: [...ids] } }).catch(() => {
		// Left in storage; nothing shows it.
	});
}

/** The pictures on a thing as this browser draws it, or none. */
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

/** The edit that gives a thing this list of pictures. */
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
 * Send one picture to be made smaller and kept; see `imageRouter`. Its bar is
 * the bytes sent, then the estimate described at `SENDING_SHARE`.
 */
async function send(
	key: string,
	kind: ImageKind,
	itemId: string,
	file: File,
): Promise<ImageRef> {
	let creeping: number | undefined;
	try {
		const [uploaded] = await uploadFiles("image", {
			files: [file],
			input: { kind, itemId },
			onUploadProgress: ({ progress }) => {
				if (creeping !== undefined) return;
				update(key, { progress: (progress / 100) * SENDING_SHARE });
				if (progress < 100) return;

				const began = Date.now();
				const expected = makingSmallerMs(file.size);
				creeping = window.setInterval(() => {
					const share = 1 - Math.exp(-(Date.now() - began) / expected);
					update(key, {
						progress: SENDING_SHARE + (99 - SENDING_SHARE) * share,
					});
				}, 100);
			},
		});
		const answer = uploaded?.serverData;
		if (!answer) throw new Error("That picture could not be saved.");
		if ("error" in answer) throw new Error(answer.error);
		return answer;
	} finally {
		window.clearInterval(creeping);
	}
}

/** Start sending a picture for a dialog; returns what it is known by here. */
function startUpload(
	kind: ImageKind,
	itemId: string,
	file: File,
	client: QueryClient,
	apply: ApplyChange,
	tell: (message: string) => void,
): string {
	const key = crypto.randomUUID();
	uploads.set(key, {
		key,
		item: itemKey(kind, itemId),
		preview: URL.createObjectURL(file),
		progress: 0,
		fate: "draft",
		image: null,
	});
	changed();

	send(key, kind, itemId, file).then(
		(image) => {
			const fate = uploads.get(key)?.fate;
			if (fate === "attach") {
				// Onto the list as it is now: others may have arrived since.
				apply(
					withImages(kind, itemId, [
						...currentImages(client, kind, itemId),
						image,
					]),
				);
				drop(key);
			} else if (fate === "discard") {
				discard([image.id]);
				drop(key);
			} else {
				update(key, { progress: 100, image });
			}
		},
		(error) => {
			if (uploads.get(key)?.fate !== "discard") tell(errorMessage(error));
			drop(key);
		},
	);
	return key;
}

/** Whether two lists of pictures are the same pictures, in order, alike. */
function sameImages(
	a: ReadonlyArray<ImageRef>,
	b: ReadonlyArray<ImageRef>,
): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export type ImageDraft = ReturnType<typeof useImageDraft>;

/**
 * A dialog's pictures for one thing — `itemId` is `null` while it has none
 * yet, and then there is nothing to edit. Started afresh from `saved` each time
 * the dialog opens; `commit` is called as it is saved, and closing it any
 * other way throws away what was sent meanwhile.
 */
export function useImageDraft(
	kind: ImageKind,
	itemId: string | null,
	saved: ReadonlyArray<ImageRef> | undefined,
	isOpen: boolean,
) {
	const client = useQueryClient();
	const { apply } = useApplyChange();
	const toast = useToast();
	const every = useUploads();

	const [images, setImages] = useState<Array<ImageRef>>(NO_IMAGES);
	/** This dialog's pictures still on their way, by key. */
	const [sending, setSending] = useState<Array<string>>([]);
	/** As the dialog opened, so what arrived since is not lost by saving. */
	const opened = useRef<ReadonlyArray<ImageRef>>(NO_IMAGES);
	/** Sent from this dialog, so on nothing yet. */
	const fresh = useRef(new Set<string>());
	const isSaved = useRef(false);

	const latest = useRef({ images, sending });
	useLayoutEffect(() => {
		latest.current = { images, sending };
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: read as the dialog opens and not followed after, as its other fields are.
	useEffect(() => {
		if (!isOpen) return;
		opened.current = saved ?? NO_IMAGES;
		fresh.current = new Set();
		isSaved.current = false;
		setImages([...(saved ?? NO_IMAGES)]);
		setSending([]);

		// Closed without saving: nothing sent meanwhile is kept.
		return () => {
			if (isSaved.current) return;
			for (const key of latest.current.sending) {
				const upload = uploads.get(key);
				if (upload?.image) {
					discard([upload.image.id]);
					drop(key);
				} else {
					update(key, { fate: "discard" });
				}
			}
			discard([...fresh.current]);
		};
	}, [isOpen]);

	// Arrived: onto the dialog's list, at the end.
	useEffect(() => {
		const arrived = every.filter(
			(upload) =>
				upload.image !== null &&
				upload.fate === "draft" &&
				sending.includes(upload.key),
		);
		if (arrived.length === 0) return;
		const keys = new Set(arrived.map((upload) => upload.key));
		for (const upload of arrived) {
			if (upload.image) fresh.current.add(upload.image.id);
		}
		setImages((now) => [
			...now,
			...arrived.flatMap((upload) => (upload.image ? [upload.image] : [])),
		]);
		setSending((now) => now.filter((key) => !keys.has(key)));
		for (const key of keys) drop(key);
	}, [every, sending]);

	const item = itemId === null ? null : itemKey(kind, itemId);
	/** On their way: this dialog's, and any a saved dialog left going. */
	const uploading = every.filter(
		(upload) =>
			upload.item === item &&
			(sending.includes(upload.key) || upload.fate === "attach"),
	);
	const room = MAX_IMAGES - images.length - uploading.length;

	function add(files: ReadonlyArray<File>) {
		if (itemId === null) return;
		const keys = files
			.slice(0, Math.max(room, 0))
			.map((file) =>
				startUpload(kind, itemId, file, client, apply, (message) =>
					toast({ body: message, type: "error", uniqueID: "image" }),
				),
			);
		setSending((now) => [...now, ...keys]);
	}

	function remove(imageId: string) {
		setImages((now) => now.filter((image) => image.id !== imageId));
	}

	/** Make this the cover, or, if it is already, have none. */
	function toggleCover(imageId: string) {
		setImages((now) =>
			now.map(({ isCover, ...image }) =>
				image.id === imageId && !isCover ? { ...image, isCover: true } : image,
			),
		);
	}

	/**
	 * Called as the dialog is saved. Pictures still on their way go on once
	 * they arrive; the list to save is returned, or `undefined` when it is as
	 * it was.
	 */
	function commit(): Array<ImageRef> | undefined {
		if (itemId === null) return undefined;
		isSaved.current = true;

		const final = [...images];
		for (const key of sending) {
			const upload = uploads.get(key);
			if (upload?.image) {
				final.push(upload.image);
				drop(key);
			} else {
				update(key, { fate: "attach" });
			}
		}

		// Anything that went on since the dialog opened — a picture an earlier
		// save left going — stays on, as no cover if this list has one.
		const current = currentImages(client, kind, itemId);
		const hasCover = final.some((image) => image.isCover);
		for (const image of current) {
			const isNew = !opened.current.some((each) => each.id === image.id);
			if (isNew && !final.some((each) => each.id === image.id)) {
				const { isCover, ...rest } = image;
				final.push(hasCover || !isCover ? rest : image);
			}
		}

		// Sent and then taken off again before saving: on nothing, ever.
		discard(
			[...fresh.current].filter((id) => !final.some((each) => each.id === id)),
		);
		return sameImages(final, current) ? undefined : final;
	}

	return { images, uploading, room, add, remove, toggleCover, commit };
}
