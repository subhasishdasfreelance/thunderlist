import { useQuery } from "@tanstack/react-query";
import { backdropsQuery } from "#/queries/preferences";
import { backdropOf, illustrationUrl, type Section } from "#/schemas/backdrop";

/**
 * The scenery behind every screen: a few big, flat shapes in the colours of
 * the part of the app on screen, and — for someone signed in — the
 * illustration they picked for it; see `.thunderlist-scenery`.
 *
 * The top of the page is kept clear and light, where the bar and the page's
 * heading sit, so nothing up there can be mistaken for a control.
 */
export function Scenery({
	section,
	isSignedIn,
}: {
	section: Section;
	isSignedIn: boolean;
}) {
	const backdrops = useQuery({ ...backdropsQuery(), enabled: isSignedIn });
	const illustrationId = isSignedIn
		? backdropOf(backdrops.data, section)
		: null;

	return (
		<div className="thunderlist-scenery" data-section={section} aria-hidden>
			<span className="thunderlist-shape thunderlist-shape-disc" />
			<span className="thunderlist-shape thunderlist-shape-blob" />
			<span className="thunderlist-shape thunderlist-shape-arch" />
			<span className="thunderlist-shape thunderlist-shape-capsule" />
			<span className="thunderlist-scenery-veil" />
			{illustrationId === null ? null : (
				<img
					// A new element for each picture, so one fades in rather than
					// swapping under the old one's fade.
					key={illustrationId}
					className="thunderlist-scenery-art"
					src={illustrationUrl(illustrationId)}
					alt=""
					decoding="async"
				/>
			)}
		</div>
	);
}
