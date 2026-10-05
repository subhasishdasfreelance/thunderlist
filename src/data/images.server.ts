/**
 * Pictures on tasks, checklists, trackers and tags. Server only.
 *
 * The browser sends a picture straight to UploadThing: a photo off a phone is
 * often bigger than a request to this server may be. Once UploadThing has it,
 * it calls back here, and the picture is read back, made smaller and stored
 * again where it belongs — `{owner}/{kind}/{item}/{random}`, see `ImageRef` —
 * and the original is deleted. The browser is handed the smaller one.
 *
 * Smaller without looking any different: turned upright, its camera details
 * and location dropped, no bigger than `MAX_SIDE` either way, and saved as
 * WebP — lossless for a PNG or a GIF, which are screenshots and drawings
 * whose sharp edges lossy coding would smear; at quality 90 for a photo,
 * where nothing it gives up can be seen. Its colour profile is kept, so a
 * photo in a wide gamut keeps its colours. When the original is smaller
 * still and has nothing to hide, the original is kept.
 */

import sharp from "sharp";
import {
	createUploadthing,
	type FileRouter,
	UploadThingError,
	UTApi,
	UTFile,
	UTFiles,
} from "uploadthing/server";
import * as v from "valibot";
import { requireScope } from "#/functions/scope";
import { createId, ID_PREFIX } from "#/lib/ids";
import { idSchema, MAX_IMAGES } from "#/schemas/common";
import { roleCan } from "#/schemas/team";
import { reportError } from "./error-report.server";

/** What pictures are put on, as they are filed in UploadThing. */
const IMAGE_KINDS = ["tasks", "checklists", "trackers", "tags"] as const;

export type ImageKind = (typeof IMAGE_KINDS)[number];

const imageUploadInputSchema = v.object({
	kind: v.picklist(IMAGE_KINDS),
	itemId: idSchema,
});

/** The longest side a picture is kept at: sharper than any screen shows it. */
const MAX_SIDE = 2560;

/** Marks the original, until the smaller one takes its place. */
const ORIGINAL_SUFFIX = "-original";

/**
 * What the browser is handed for each picture: where it is kept — see
 * `ImageRef` — or why it could not be. Never thrown: UploadThing drops an error
 * thrown here, and the browser waits for an answer that never comes.
 */
type ImageUploaded = { id: string; url: string } | { error: string };

const upload = createUploadthing();
const utapi = new UTApi();

/**
 * The picture as it will be kept, or `null` to keep the original: one that is
 * already smaller than anything made from it, and carries no camera details.
 * An SVG is kept as it is: it is drawn, not photographed, and has no pixels to
 * save.
 */
async function optimise(
	original: Uint8Array,
): Promise<Uint8Array<ArrayBuffer> | null> {
	const metadata = await sharp(original).metadata();
	if (metadata.format === "svg") return null;

	const isLossless = metadata.format === "png" || metadata.format === "gif";
	// The width and height a camera wrote, the right way up.
	const longest = Math.max(
		metadata.autoOrient.width,
		metadata.autoOrient.height,
	);
	const isResized = longest > MAX_SIDE;

	const made = await sharp(original, { animated: true })
		.autoOrient()
		.resize({
			width: MAX_SIDE,
			height: MAX_SIDE,
			fit: "inside",
			withoutEnlargement: true,
		})
		.keepIccProfile()
		.webp(
			isLossless
				? { lossless: true, effort: 6 }
				: { quality: 90, effort: 6, smartSubsample: true },
		)
		.toBuffer();

	const isOriginalBetter =
		!isResized &&
		metadata.exif === undefined &&
		original.byteLength <= made.byteLength;
	return isOriginalBetter ? null : new Uint8Array(made);
}

/** Made smaller and stored in the original's place; see the top of this file. */
async function replaceWithSmaller(file: {
	key: string;
	name: string;
	customId: string | null;
	ufsUrl: string;
}): Promise<ImageUploaded> {
	const originalId = file.customId ?? file.key;
	const response = await fetch(file.ufsUrl);
	if (!response.ok) {
		throw new Error(`Reading the upload back failed: ${response.status}`);
	}

	let made: Awaited<ReturnType<typeof optimise>>;
	try {
		made = await optimise(new Uint8Array(await response.arrayBuffer()));
	} catch {
		await utapi.deleteFiles(file.key);
		return {
			error: "That picture could not be read. Try a JPEG, PNG or WebP.",
		};
	}
	if (made === null) return { id: originalId, url: file.ufsUrl };

	const id = originalId.endsWith(ORIGINAL_SUFFIX)
		? originalId.slice(0, -ORIGINAL_SUFFIX.length)
		: `${originalId}-small`;
	const name = `${file.name.replace(/\.[^.]*$/, "")}.webp`;
	const stored = await utapi.uploadFiles(
		new UTFile([made], name, { customId: id, type: "image/webp" }),
	);
	if (stored.error !== null) throw stored.error;

	await utapi.deleteFiles(file.key);
	return { id, url: stored.data.ufsUrl };
}

export const imageRouter = {
	image: upload({
		image: { maxFileSize: "16MB", maxFileCount: MAX_IMAGES },
	})
		.input(imageUploadInputSchema)
		.middleware(async ({ input, files }) => {
			// Only someone who can change things here may add to its storage. The
			// edit the picture is saved with is checked again, as any edit is.
			const scope = await requireScope().catch(() => null);
			if (scope === null) {
				throw new UploadThingError({
					code: "FORBIDDEN",
					message: "Sign in to add pictures.",
				});
			}
			const { team } = scope;
			if (
				team !== null &&
				!roleCan(team.role, "updateTasks") &&
				!roleCan(team.role, "manageContent")
			) {
				throw new UploadThingError({
					code: "FORBIDDEN",
					message: "Your role here cannot add pictures.",
				});
			}

			const folder = `${scope.ownerId}/${input.kind}/${input.itemId}`;
			return {
				[UTFiles]: files.map((file) => ({
					...file,
					customId: `${folder}/${createId(ID_PREFIX.image)}${ORIGINAL_SUFFIX}`,
				})),
			};
		})
		.onUploadComplete(async ({ file }): Promise<ImageUploaded> => {
			try {
				return await replaceWithSmaller(file);
			} catch (error) {
				console.error("[thunderlist] image upload failed:", error);
				await reportError("image upload", error);
				return { error: "That picture could not be saved. Please try again." };
			}
		}),
} satisfies FileRouter;

export type ImageRouter = typeof imageRouter;
