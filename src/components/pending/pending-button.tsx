import { Button } from "@astryxdesign/core/Button";
import { CloudUpload } from "lucide-react";
import { useState } from "react";
import { usePendingChanges } from "#/lib/pending/store";
import { PendingReviewDialog } from "./pending-review-dialog";

/**
 * The save control in the top bar.
 *
 * Nothing in the app reaches the database until this is used, so it doubles as
 * the only place the count of outstanding edits is shown. It stays put with
 * nothing queued rather than disappearing, so the one control that saves work
 * is always in the same place.
 */
export function PendingButton() {
	const queued = usePendingChanges();
	const [isOpen, setIsOpen] = useState(false);

	const hasChanges = queued.length > 0;
	const label = hasChanges
		? `Review ${queued.length} unsaved ${queued.length === 1 ? "change" : "changes"}`
		: "Nothing to save";

	return (
		<>
			<Button
				label={label}
				tooltip={label}
				variant={hasChanges ? "secondary" : "ghost"}
				size="sm"
				isIconOnly={!hasChanges}
				icon={<CloudUpload aria-hidden />}
				onClick={() => setIsOpen(true)}
			>
				{hasChanges ? queued.length : undefined}
			</Button>

			<PendingReviewDialog isOpen={isOpen} onOpenChange={setIsOpen} />
		</>
	);
}
