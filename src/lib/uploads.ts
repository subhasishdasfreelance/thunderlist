import { generateReactHelpers } from "@uploadthing/react";
import type { ImageKind, ImageRouter } from "#/data/images.server";
import type { ImageRef } from "#/schemas/common";

const { uploadFiles } = generateReactHelpers<ImageRouter>({
	url: "/api/uploadthing",
});

/**
 * Send one picture to be made smaller and kept, filed under what it is on;
 * resolves with where it is kept, or rejects saying why it was not.
 */
export async function uploadImage(
	kind: ImageKind,
	itemId: string,
	file: File,
): Promise<ImageRef> {
	const [uploaded] = await uploadFiles("image", {
		files: [file],
		input: { kind, itemId },
	});
	const answer = uploaded?.serverData;
	if (!answer) throw new Error("That picture could not be saved.");
	if ("error" in answer) throw new Error(answer.error);
	return answer;
}
