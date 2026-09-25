import type { CSSProperties } from "react";
import type { TagColor } from "#/schemas/tag";

/**
 * A stage's colour as the custom property its part of the bar, its dot and
 * its tasks' checkboxes are drawn from.
 *
 * The colour itself, undiluted: a dot on a bar a few pixels tall is read
 * against the page and nothing else. All of them are picked to clear 3:1
 * there in both schemes; see `--thunderlist-color-*` in `styles.css`.
 */
export function stageColorStyle(color: TagColor): CSSProperties {
	return {
		"--thunderlist-stage-color": `var(--thunderlist-color-${color})`,
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
