import { Spinner } from "@astryxdesign/core/Spinner";
import { useIsMutating } from "@tanstack/react-query";

/**
 * A quiet spinner in the bar while a change is still on its way to the server.
 *
 * Edits draw the instant they are made now, so nothing on the screen says a
 * save is still in the air. This does — in the corner, where it can be glanced
 * at and ignored, rather than over the row it belongs to, which would undo the
 * point of drawing that row immediately.
 *
 * The slot is always there and only its contents come and go, so the controls
 * beside it never shift when a save starts.
 */
export function SaveIndicator() {
	const saving = useIsMutating();

	return (
		<span
			className="thunderlist-save-indicator"
			data-busy={saving > 0 ? "true" : "false"}
			aria-hidden={saving === 0}
		>
			{saving > 0 ? <Spinner size="sm" aria-label="Saving" /> : null}
		</span>
	);
}
