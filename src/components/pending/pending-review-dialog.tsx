import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Spinner } from "@astryxdesign/core/Spinner";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { applyChangesFn } from "#/functions/pending.functions";
import { errorMessage } from "#/lib/errors";
import { MAX_IN_FLIGHT } from "#/lib/pending/plan";
import {
	discard,
	discardAll,
	dropApplied,
	usePendingChanges,
} from "#/lib/pending/store";
import { MAX_BATCH_SIZE } from "#/schemas/pending";
import {
	isLocked,
	NOT_SAVING,
	type SaveProgress,
	SaveProgressBar,
	stateAt,
} from "./save-progress";

/** "2 minutes ago", in the viewer's locale. */
function queuedAgo(iso: string): string {
	const seconds = Math.round((Date.parse(iso) - Date.now()) / 1000);
	if (!Number.isFinite(seconds)) return "";

	const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
	const minutes = Math.round(seconds / 60);

	if (Math.abs(seconds) < 60) return format.format(seconds, "second");
	if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
	return format.format(Math.round(minutes / 60), "hour");
}

/** The mark at the end of a row, saying where that change has got to. */
function StateMark({ state }: { state: ReturnType<typeof stateAt> }) {
	if (state === "saved") {
		return (
			<span className="thunderlist-pop">
				<Icon icon={Check} size="sm" color="success" />
			</span>
		);
	}

	// `label` would render visible text under the ring; the row already says
	// what is being saved, so the name is for screen readers only.
	if (state === "saving") return <Spinner size="sm" aria-label="Saving" />;

	return null;
}

/**
 * Review what is queued, then save it — or throw it away.
 *
 * Saving is the only thing in the app that writes to the database, so this is
 * the one place edits become permanent, and the one place worth showing the
 * work happening. The batch goes out five at a time — enough to hide the
 * round-trip latency, few enough never to go near a rate limit — and each pass
 * moves the bar and marks off the rows it wrote.
 *
 * A change that has been written, or is being written, can no longer be
 * discarded: it is already in the database, and offering to take it back would
 * be offering something the button cannot do.
 *
 * A batch can stop part way through. When it does, the changes that did go in
 * are dropped from the queue and the rest are left for another attempt — never
 * silently lost, never applied twice.
 */
export function PendingReviewDialog({
	isOpen,
	onOpenChange,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const queued = usePendingChanges();

	const [isSaving, setIsSaving] = useState(false);
	const [progress, setProgress] = useState<SaveProgress>(NOT_SAVING);
	const [error, setError] = useState<string | null>(null);
	const [isDiscarding, setIsDiscarding] = useState(false);

	const batch = queued.slice(0, MAX_BATCH_SIZE);
	const hasChanges = queued.length > 0;

	/**
	 * Send the batch in passes of five, reporting between them.
	 *
	 * The queue is only trimmed once the whole run is over: a row has to stay on
	 * screen to be shown as saved, and dropping it the moment it lands would make
	 * the list shuffle upwards under the user's eyes instead.
	 */
	async function save() {
		const changes = batch.map((entry) => entry.change);

		setIsSaving(true);
		setError(null);
		setProgress({ saved: 0, saving: 0, total: changes.length });

		let saved = 0;

		try {
			while (saved < changes.length) {
				const pass = changes.slice(saved, saved + MAX_IN_FLIGHT);
				setProgress({ saved, saving: pass.length, total: changes.length });

				const result = await applyChangesFn({ data: { changes: pass } });
				saved += result.appliedCount;
				setProgress({ saved, saving: 0, total: changes.length });

				if (result.failure) {
					setError(result.failure.message);
					break;
				}
			}
		} catch (caught) {
			setError(errorMessage(caught));
		} finally {
			// Whatever happened, exactly what landed leaves the queue and the rest
			// stays for another attempt.
			dropApplied(saved);
			await queryClient.invalidateQueries();
			setIsSaving(false);
			setProgress(NOT_SAVING);

			// Stay open if something failed, or if there is another pass to run.
			if (saved === changes.length && queued.length <= batch.length) {
				onOpenChange(false);
			}
		}
	}

	return (
		<>
			<FormDialog
				isOpen={isOpen}
				onOpenChange={(open) => {
					// Closing mid-save would hide the only report of what landed.
					if (!isSaving) onOpenChange(open);
				}}
				title="Unsaved changes"
				subtitle={
					hasChanges
						? `${queued.length} ${queued.length === 1 ? "change" : "changes"} waiting to be written`
						: undefined
				}
				width={520}
				actions={() => (
					<HStack gap={2} hAlign="between" vAlign="center">
						{hasChanges ? (
							<Button
								label="Discard all"
								variant="ghost"
								isDisabled={isSaving}
								onClick={() => setIsDiscarding(true)}
							/>
						) : (
							<Button
								label="Close"
								variant="ghost"
								onClick={() => onOpenChange(false)}
							/>
						)}
						{hasChanges ? (
							<Button
								label={`Save ${batch.length}`}
								variant="primary"
								isLoading={isSaving}
								onClick={() => void save()}
							/>
						) : null}
					</HStack>
				)}
			>
				<VStack gap={3}>
					{isSaving || progress.total > 0 ? (
						<SaveProgressBar progress={progress} />
					) : null}

					{hasChanges ? (
						<VStack gap={0}>
							{queued.map((entry, index) => {
								const state = stateAt(progress, index);
								const locked = isSaving && isLocked(progress, index);

								return (
									<div
										key={entry.id}
										className="thunderlist-row"
										data-state={state}
									>
										{index === 0 ? null : <Divider />}
										<HStack
											gap={2}
											hAlign="between"
											vAlign="center"
											paddingBlock={2}
										>
											<HStack gap={2} vAlign="center">
												<StateMark state={isSaving ? state : "queued"} />
												<VStack gap={0}>
													<Text
														color={state === "saved" ? "secondary" : "primary"}
													>
														{entry.label}
													</Text>
													<Text type="supporting">
														{index < MAX_BATCH_SIZE
															? queuedAgo(entry.queuedAt)
															: `${queuedAgo(entry.queuedAt)} · saves on the next pass`}
													</Text>
												</VStack>
											</HStack>
											<IconButton
												label={`Discard: ${entry.label}`}
												tooltip={locked ? "Already saved" : "Discard"}
												variant="ghost"
												size="sm"
												icon={<X aria-hidden />}
												isDisabled={locked}
												onClick={() => discard(entry.id)}
											/>
										</HStack>
									</div>
								);
							})}
						</VStack>
					) : (
						<Text color="secondary">
							Nothing is waiting to be saved. Everything you have changed is
							already in the database.
						</Text>
					)}

					{error ? (
						<span className="text-error">
							<Text type="supporting" color="inherit">
								{error}
							</Text>
						</span>
					) : null}
				</VStack>
			</FormDialog>

			<AlertDialog
				isOpen={isDiscarding}
				onOpenChange={setIsDiscarding}
				title="Discard every unsaved change?"
				description={`${queued.length} ${queued.length === 1 ? "change" : "changes"} will be thrown away. Nothing already saved is touched.`}
				actionLabel="Discard"
				onAction={() => {
					discardAll();
					setIsDiscarding(false);
					onOpenChange(false);
				}}
			/>
		</>
	);
}
