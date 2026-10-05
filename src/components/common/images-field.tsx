import { Button } from "@astryxdesign/core/Button";
import { Lightbox } from "@astryxdesign/core/Lightbox";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { ImagePlus } from "lucide-react";
import {
	type Dispatch,
	memo,
	type SetStateAction,
	useEffect,
	useRef,
	useState,
} from "react";
import type { ImageKind } from "#/data/images.server";
import { errorMessage } from "#/lib/errors";
import { useToast } from "#/lib/toasts";
import { uploadImage } from "#/lib/uploads";
import { type ImageRef, MAX_IMAGES } from "#/schemas/common";

/** A picture on its way: shown from the device while it is sent. */
type Pending = { key: string; preview: string };

/**
 * The pictures on a task, a checklist, a tracker or a tag: added, looked at
 * full size and removed here, and saved with the rest of the dialog.
 *
 * A picture is drawn the moment it is picked, from the device, and sent at
 * once to be made smaller and kept; see `imageRouter`. `onPendingChange` says
 * how many are still on their way, so the dialog waits for them before it
 * saves.
 */
export const ImagesField = memo(function ImagesField({
	kind,
	itemId,
	value,
	onChange,
	onPendingChange,
}: {
	kind: ImageKind;
	itemId: string;
	value: ReadonlyArray<ImageRef>;
	onChange: Dispatch<SetStateAction<Array<ImageRef>>>;
	onPendingChange: (count: number) => void;
}) {
	const toast = useToast();
	const input = useRef<HTMLInputElement>(null);
	const [pending, setPending] = useState<Array<Pending>>([]);
	const [shown, setShown] = useState<number | null>(null);
	const room = MAX_IMAGES - value.length - pending.length;

	useEffect(() => {
		onPendingChange(pending.length);
	}, [pending.length, onPendingChange]);

	function add(files: ReadonlyArray<File>) {
		for (const file of files.slice(0, Math.max(room, 0))) {
			const key = crypto.randomUUID();
			const preview = URL.createObjectURL(file);
			setPending((all) => [...all, { key, preview }]);

			uploadImage(kind, itemId, file)
				.then((image) => onChange((images) => [...images, image]))
				.catch((error) =>
					toast({ body: errorMessage(error), type: "error", uniqueID: key }),
				)
				.finally(() => {
					setPending((all) => all.filter((each) => each.key !== key));
					URL.revokeObjectURL(preview);
				});
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
						{pending.length > 0
							? `Uploading ${pending.length}…`
							: "Made smaller as they are uploaded, without losing quality."}
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

			{value.length === 0 && pending.length === 0 ? null : (
				<div className="flex flex-wrap gap-2">
					{value.map((image, index) => (
						<Thumbnail
							key={image.id}
							src={image.url}
							alt={`Image ${index + 1}`}
							onClick={() => setShown(index)}
							onRemove={() =>
								onChange((images) =>
									images.filter((each) => each.id !== image.id),
								)
							}
						/>
					))}
					{pending.map((each) => (
						<Thumbnail
							key={each.key}
							src={each.preview}
							alt="Uploading image"
							isDisabled
						/>
					))}
				</div>
			)}

			{value.length === 0 ? null : (
				<Lightbox
					isOpen={shown !== null}
					onOpenChange={(isOpen) => {
						if (!isOpen) setShown(null);
					}}
					media={value.map((image, index) => ({
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
