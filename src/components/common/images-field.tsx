import { Button } from "@astryxdesign/core/Button";
import { Lightbox } from "@astryxdesign/core/Lightbox";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { memo, useRef, useState } from "react";
import type { ImageKind } from "#/data/images.server";
import { useApplyChange } from "#/lib/changes";
import { errorMessage } from "#/lib/errors";
import { useToast } from "#/lib/toasts";
import {
	addImage,
	type PendingImage,
	removeImage,
	useImages,
	usePendingImages,
} from "#/lib/uploads";
import { MAX_IMAGES } from "#/schemas/common";

/**
 * The pictures on a task, a checklist, a tracker or a tag: added, looked at
 * full size and removed here.
 *
 * Each is saved on its own as it happens, not with the dialog's other fields;
 * see `addImage`. A picture picked is drawn at once, with a bar for how far it
 * has got, and closing the dialog does not stop it.
 */
export const ImagesField = memo(function ImagesField({
	kind,
	itemId,
}: {
	kind: ImageKind;
	itemId: string;
}) {
	const client = useQueryClient();
	const { apply } = useApplyChange();
	const toast = useToast();
	const input = useRef<HTMLInputElement>(null);
	const images = useImages(kind, itemId);
	const pending = usePendingImages(kind, itemId);
	const [shown, setShown] = useState<number | null>(null);
	const room = MAX_IMAGES - images.length - pending.length;

	function add(files: ReadonlyArray<File>) {
		for (const file of files.slice(0, Math.max(room, 0))) {
			addImage(client, apply, kind, itemId, file).catch((error) =>
				toast({ body: errorMessage(error), type: "error", uniqueID: "image" }),
			);
		}
	}

	return (
		<VStack gap={2}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<VStack gap={0}>
					<Text type="label" weight="semibold">
						Images
					</Text>
					<Text type="supporting">
						Made smaller as they are uploaded, without losing quality.
					</Text>
				</VStack>
				<Button
					label="Add images"
					icon={<ImagePlus aria-hidden />}
					variant="ghost"
					size="sm"
					isDisabled={room <= 0}
					onClick={() => input.current?.click()}
				/>
			</HStack>

			<input
				ref={input}
				type="file"
				accept="image/*"
				multiple
				hidden
				onChange={(event) => {
					add([...(event.target.files ?? [])]);
					// Picking the same picture again is a new pick.
					event.target.value = "";
				}}
			/>

			{images.length === 0 && pending.length === 0 ? null : (
				<div className="flex flex-wrap gap-2">
					{images.map((image, index) => (
						<Thumbnail
							key={image.id}
							src={image.url}
							alt={`Image ${index + 1}`}
							onClick={() => setShown(index)}
							onRemove={() =>
								removeImage(client, apply, kind, itemId, image.id)
							}
						/>
					))}
					{pending.map((each) => (
						<Uploading key={each.key} image={each} />
					))}
				</div>
			)}

			{images.length === 0 ? null : (
				<Lightbox
					isOpen={shown !== null}
					onOpenChange={(isOpen) => {
						if (!isOpen) setShown(null);
					}}
					media={images.map((image, index) => ({
						src: image.url,
						alt: `Image ${index + 1}`,
					}))}
					index={shown ?? 0}
					onIndexChange={setShown}
					hasZoom
				/>
			)}
		</VStack>
	);
});

/**
 * A picture on its way: drawn from the device, with a thin bar across its foot
 * filling as it is sent, then moving on its own while it is made smaller.
 */
function Uploading({ image }: { image: PendingImage }) {
	const isSent = image.progress >= 100;

	return (
		<div className="relative">
			<Thumbnail src={image.preview} alt="Uploading image" isDisabled />
			<div className="absolute inset-x-1 bottom-1">
				<ProgressBar
					label={isSent ? "Making it smaller" : "Uploading"}
					isLabelHidden
					value={image.progress}
					isIndeterminate={isSent}
				/>
			</div>
		</div>
	);
}
