import { useQuery } from "@tanstack/react-query";
import { type CSSProperties, useState } from "react";
import { backdropsQuery } from "#/queries/preferences";
import { backdropOf, type Page, paletteColors } from "#/schemas/backdrop";
import type { DesignId } from "#/schemas/backdrop-designs";
import { BackdropArt } from "./backdrop-art";

/** One drawing of the backdrop: a design in its colours. */
type Art = {
	key: string;
	design: DesignId | null;
	colors: readonly [string, string, string];
};

/**
 * The background behind every screen: the design picked for the page on
 * screen, in the colours picked for it, or those it starts with; see
 * `BackdropDialog`. Signed out, it is how Today starts.
 *
 * The top of the page is kept clear and light, where the bar and the page's
 * heading sit, so nothing up there can be mistaken for a control.
 *
 * Going to a page drawn differently, the old drawing fades out as
 * the new one fades in, and the wash beneath them eases from one colour to the
 * other; see `.thunderlist-scenery-art`. The first drawing is simply there.
 */
export function Scenery({
	page,
	isSignedIn,
}: {
	page: Page;
	isSignedIn: boolean;
}) {
	const backdrops = useQuery({ ...backdropsQuery(), enabled: isSignedIn });
	const backdrop = backdropOf(backdrops.data, page);
	const colors = paletteColors(backdrop, page.section);
	const key = `${backdrop.design}|${colors.join()}`;

	// The drawing on screen, and the one fading out from under it.
	const [shown, setShown] = useState<{
		current: Art;
		leaving: Art | null;
		hasChanged: boolean;
	}>({
		current: { key, design: backdrop.design, colors },
		leaving: null,
		hasChanged: false,
	});
	if (shown.current.key !== key) {
		setShown({
			current: { key, design: backdrop.design, colors },
			leaving: shown.current,
			hasChanged: true,
		});
	}

	return (
		<div
			className="thunderlist-scenery"
			aria-hidden
			style={{ "--deco-1": colors[0] } as CSSProperties}
		>
			{shown.leaving?.design == null ? null : (
				<div
					key={shown.leaving.key}
					className="thunderlist-scenery-art"
					data-leaving
					onAnimationEnd={(event) => {
						if (event.target !== event.currentTarget) return;
						setShown((previous) => ({ ...previous, leaving: null }));
					}}
				>
					<BackdropArt
						designId={shown.leaving.design}
						colors={shown.leaving.colors}
					/>
				</div>
			)}
			{shown.current.design === null ? null : (
				<div
					key={shown.current.key}
					className="thunderlist-scenery-art"
					data-entering={shown.hasChanged || undefined}
				>
					<BackdropArt
						designId={shown.current.design}
						colors={shown.current.colors}
					/>
				</div>
			)}
			<span className="thunderlist-scenery-veil" />
		</div>
	);
}
