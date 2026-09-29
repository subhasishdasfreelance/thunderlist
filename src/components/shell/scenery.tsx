import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { backdropsQuery } from "#/queries/preferences";
import { backdropOf, paletteColors, type Section } from "#/schemas/backdrop";
import { BackdropArt } from "./backdrop-art";

/**
 * The background behind every screen: the design picked for the part of the
 * app on screen, in the colours picked for it, or those it starts with; see
 * `BackdropDialog`. Signed out, it is how Today starts.
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
	const backdrop = backdropOf(backdrops.data, section);
	const colors = paletteColors(backdrop, section);

	return (
		<div
			className="thunderlist-scenery"
			aria-hidden
			style={{ "--deco-1": colors[0] } as CSSProperties}
		>
			{backdrop.design === null ? null : (
				<BackdropArt designId={backdrop.design} colors={colors} />
			)}
			<span className="thunderlist-scenery-veil" />
		</div>
	);
}
