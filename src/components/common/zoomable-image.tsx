import { Lightbox } from "@astryxdesign/core/Lightbox";
import { useState } from "react";
import { createPortal } from "react-dom";
import { FadeImage } from "./fade-image";

/**
 * A picture that opens full size when pressed, growing into view over
 * everything — with the others it belongs with, to step through, when there
 * are any.
 *
 * The viewer is drawn at the end of the page rather than inside the row or
 * card the picture sits on: a row answers to keys while the pointer is over it
 * (see `useRowShortcuts`), and a card opens when pressed, and neither should
 * hear what is done in the viewer.
 */
export function ZoomableImage({
	src,
	alt,
	className,
	gallery,
}: {
	src: string;
	/** What it shows; empty for a cover, which the thing's title names. */
	alt: string;
	className?: string;
	/** Every picture to step through, this one among them. Just this one when left out. */
	gallery?: ReadonlyArray<string>;
}) {
	const [shown, setShown] = useState<number | null>(null);
	// A tracker's linked cover is not among its pictures; it is shown alone.
	const sources = gallery?.includes(src) ? gallery : [src];
	const name = alt || "image";

	return (
		<>
			<button
				type="button"
				className="thunderlist-zoomable"
				aria-label={`View ${name} full size`}
				onClick={(event) => {
					// Not the card or link it sits on.
					event.preventDefault();
					event.stopPropagation();
					setShown(sources.indexOf(src));
				}}
			>
				<FadeImage src={src} alt={alt} className={className} />
			</button>

			{shown === null
				? null
				: createPortal(
						// Pressing in the viewer is not pressing the card it opened from.
						// biome-ignore lint/a11y/noStaticElementInteractions: only stops clicks reaching the card; the viewer has its own keys.
						// biome-ignore lint/a11y/useKeyWithClickEvents: as above.
						<div onClick={(event) => event.stopPropagation()}>
							<Lightbox
								className="thunderlist-lightbox"
								isOpen
								onOpenChange={(isOpen) => {
									if (!isOpen) setShown(null);
								}}
								media={sources.map((each, index) => ({
									src: each,
									alt: alt || `Image ${index + 1}`,
								}))}
								index={shown}
								onIndexChange={setShown}
								hasZoom
							/>
						</div>,
						document.body,
					)}
		</>
	);
}
