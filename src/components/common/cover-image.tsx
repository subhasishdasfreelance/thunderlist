import { coverOf, type ImageRef } from "#/schemas/common";
import { ZoomableImage } from "./zoomable-image";

/** How big the cover is drawn: at the start of a row, on a card, atop a page. */
const SIZES = {
	row: "h-8 w-8",
	card: "h-14 w-14",
	page: "h-20 w-20",
} as const;

/**
 * The picture chosen to stand for a task, a checklist or a tag, square — or
 * nothing, for one with no cover; see `coverOf`. A tracker draws its own, the
 * shape of a book. Pressed, it opens full size among the thing's other
 * pictures.
 */
export function CoverImage({
	images,
	size,
}: {
	images: ReadonlyArray<ImageRef> | undefined;
	size: keyof typeof SIZES;
}) {
	const cover = coverOf(images);
	if (cover === null) return null;

	return (
		<ZoomableImage
			src={cover.url}
			alt=""
			gallery={images?.map((image) => image.url)}
			className={`${SIZES[size]} shrink-0 rounded-sm border border-border object-cover`}
		/>
	);
}
