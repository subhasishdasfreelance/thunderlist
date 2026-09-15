import type { CSSProperties } from "react";
import type { TagColor } from "#/schemas/tag";

/**
 * A stage's colour as the custom property its part of the bar, its dot and
 * its tasks' checkboxes are drawn from: the saturated step of the Token
 * colour, which Astryx keeps readable against the surface in both schemes.
 */
export function stageColorStyle(color: TagColor): CSSProperties {
	return {
		"--thunderlist-stage-color": `var(--color-icon-${color})`,
	} as CSSProperties;
}

/**
 * A stage's colour as a dot: the key to a checklist's bar, and its mark in a
 * menu. `null` is the first stage, drawn as an empty ring, as the bar's track
 * is empty.
 */
export function StageDot({ color }: { color: TagColor | null }) {
	return (
		<span
			aria-hidden
			className="thunderlist-stage-dot"
			data-empty={color === null}
			style={color === null ? undefined : stageColorStyle(color)}
		/>
	);
}
