import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Lightbox } from "@astryxdesign/core/Lightbox";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { Image, ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import type { ImageDraft, Upload } from "#/lib/uploads";

/**
 * The pictures on a task, a checklist, a tracker or a tag: added, looked at
 * full size, made the cover and taken off here, and saved with the rest of
 * the dialog; see `useImageDraft`.
 *
 * A picture picked is sent at once and drawn at once, with a bar filling as it
 * goes. The cover is the one that stands for the thing — on its card, at the
 * head of its page, at the start of its row.
 */
export function ImagesField({ draft }: { draft: ImageDraft }) {
	const input = useRef<HTMLInputElement>(null);
	const [shown, setShown] = useState<number | null>(null);
	const { images, uploading } = draft;

	return (
		<VStack gap={2}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<VStack gap={0}>
					<Text type="label" weight="semibold">
						Images
					</Text>
					<Text type="supporting">
						Pick one as the cover. Made smaller as they upload, without losing
						quality.
					</Text>
				</VStack>
				<Button
					label="Add images"
					icon={<ImagePlus aria-hidden />}
					variant="ghost"
					size="sm"
					isDisabled={draft.room <= 0}
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
					draft.add([...(event.target.files ?? [])]);
					// Picking the same picture again is a new pick.
					event.target.value = "";
				}}
			/>

			{images.length === 0 && uploading.length === 0 ? null : (
				<div className="flex flex-wrap gap-2">
					{images.map((image, index) => (
						<VStack key={image.id} gap={1} hAlign="center">
							<Thumbnail
								src={image.url}
								alt={`Image ${index + 1}`}
								onClick={() => setShown(index)}
								onRemove={() => draft.remove(image.id)}
							/>
							<IconButton
								label={
									image.isCover
										? `Image ${index + 1} is the cover`
										: `Make image ${index + 1} the cover`
								}
								tooltip={image.isCover ? "Cover" : "Make cover"}
								icon={<Image aria-hidden />}
								variant={image.isCover ? "secondary" : "ghost"}
								size="sm"
								onClick={() => draft.toggleCover(image.id)}
							/>
						</VStack>
					))}
					{uploading.map((upload) => (
						<Uploading key={upload.key} upload={upload} />
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
}

/**
 * A picture on its way: drawn from the device, with a bar across its foot
 * filling from 0 to 100 as it goes; see `SENDING_SHARE`.
 */
function Uploading({ upload }: { upload: Upload }) {
	return (
		<div className="relative">
			<Thumbnail src={upload.preview} alt="Uploading image" isDisabled />
			<div className="absolute inset-x-1 bottom-1">
				<ProgressBar
					label="Uploading"
					isLabelHidden
					value={Math.round(upload.progress)}
				/>
			</div>
		</div>
	);
}
