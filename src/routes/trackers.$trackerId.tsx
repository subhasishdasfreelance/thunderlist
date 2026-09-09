import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PaceLabel } from "#/components/common/pace-label";
import { ProgressMeter } from "#/components/common/progress-meter";
import { ErrorNotice, RowListSkeleton } from "#/components/common/states";
import { VelocityStats } from "#/components/common/velocity-stats";
import { EntryFormDialog } from "#/components/trackers/entry-form-dialog";
import { ProgressHistory } from "#/components/trackers/progress-history";
import { formatProgress } from "#/components/trackers/tracker-card";
import { TrackerFormDialog } from "#/components/trackers/tracker-form-dialog";
import { formatDate } from "#/lib/format-date";
import {
	type EntryValues,
	queueCreateEntry,
	queueDeleteEntry,
	queueDeleteTracker,
	queueUpdateEntry,
	queueUpdateTracker,
	type TrackerValues,
} from "#/lib/pending/actions";
import {
	overlayTrackerDetail,
	pendingTrackerDetail,
} from "#/lib/pending/overlay-trackers";
import { usePendingChanges } from "#/lib/pending/store";
import { elapsedFraction } from "#/lib/progress";
import { primeQuery } from "#/queries/prime";
import { trackerQuery } from "#/queries/trackers";
import { type ProgressEntry, TRACKER_TYPE_LABELS } from "#/schemas/tracker";

export const Route = createFileRoute("/trackers/$trackerId")({
	loader: ({ context, params }) =>
		primeQuery(context.queryClient, trackerQuery(params.trackerId)),
	component: TrackerDetailPage,
});

type EntryDialogState =
	| { mode: "closed" }
	| { mode: "create" }
	| { mode: "edit"; entry: ProgressEntry };

function TrackerDetailPage() {
	const { trackerId } = Route.useParams();
	const navigate = useNavigate();
	const queued = usePendingChanges();

	const [entryDialog, setEntryDialog] = useState<EntryDialogState>({
		mode: "closed",
	});
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [pendingEntry, setPendingEntry] = useState<ProgressEntry | null>(null);
	const [isDeletingTracker, setIsDeletingTracker] = useState(false);

	const { data, isPending, isError, error, refetch } = useQuery(
		trackerQuery(trackerId),
	);

	// A tracker created a moment ago exists only in the queue, so there is
	// nothing to fetch: it is built from the queue instead.
	const detail = useMemo(
		() =>
			data
				? overlayTrackerDetail(data, queued)
				: pendingTrackerDetail(trackerId, queued),
		[data, queued, trackerId],
	);

	if (isError && detail === null) {
		return (
			<VStack gap={4}>
				<Link href="/trackers">Back to trackers</Link>
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			</VStack>
		);
	}

	if (isPending || !detail) {
		return (
			<VStack gap={4}>
				<Link href="/trackers">Back to trackers</Link>
				<Card padding={4}>
					<RowListSkeleton count={5} />
				</Card>
			</VStack>
		);
	}

	const { progress } = detail;
	const elapsed = elapsedFraction({
		startDate: detail.startDate,
		deadline: detail.deadline,
	});

	/**
	 * The reading an entry is measured from. For a new entry that is where the
	 * tracker stands now; for an edit it is the entry immediately before it, so
	 * the step shown while editing matches the one that will be stored.
	 */
	const previousValue =
		entryDialog.mode === "edit"
			? (detail.entries[
					detail.entries.findIndex(
						(entry) => entry.entryId === entryDialog.entry.entryId,
					) - 1
				]?.value ?? 0)
			: detail.currentValue;

	const addLabel =
		detail.type === "book" ? "Add reading progress" : "Add progress";

	return (
		<VStack gap={4}>
			<Link href="/trackers">Back to trackers</Link>

			<HStack gap={3} hAlign="between" vAlign="start">
				<HStack gap={3} vAlign="center">
					{detail.coverUrl ? (
						<img
							src={detail.coverUrl}
							alt=""
							className="h-20 w-14 shrink-0 rounded-sm border border-border object-cover"
						/>
					) : null}
					<VStack gap={1}>
						<Heading level={1}>{detail.title}</Heading>
						<HStack gap={2} vAlign="center">
							<Token label={TRACKER_TYPE_LABELS[detail.type]} size="sm" />
							{detail.author ? (
								<Text type="supporting">{detail.author}</Text>
							) : null}
						</HStack>
					</VStack>
				</HStack>

				<DropdownMenu
					hasChevron={false}
					placement="below"
					alignment="end"
					button={{ label: "Tracker actions", variant: "ghost" }}
					items={[
						{ label: "Edit tracker", onClick: () => setIsEditOpen(true) },
						{
							label: "Delete tracker",
							variant: "destructive" as const,
							onClick: () => setIsDeletingTracker(true),
						},
					]}
				/>
			</HStack>

			<Card padding={4}>
				<VStack gap={3}>
					<HStack gap={2} hAlign="between" vAlign="center">
						<Text type="large" weight="semibold">
							{formatProgress(progress.current, progress.target, detail.unit)}
						</Text>
						<PaceLabel status={detail.status} />
					</HStack>

					<ProgressMeter
						label={`${detail.title} progress`}
						percent={progress.percent}
						expectedPercent={elapsed === null ? null : elapsed * 100}
						footnote={`${progress.percent}% complete${
							detail.deadline ? ` · due ${formatDate(detail.deadline)}` : ""
						}`}
					/>

					{detail.description === "" ? null : (
						<Text color="secondary">{detail.description}</Text>
					)}
				</VStack>
			</Card>

			<VelocityStats
				velocity={detail.velocity}
				unit={detail.unit}
				isComplete={progress.target > 0 && progress.current >= progress.target}
			/>

			<HStack gap={2}>
				<Button
					label={addLabel}
					variant="primary"
					onClick={() => setEntryDialog({ mode: "create" })}
				/>
			</HStack>

			<ProgressHistory
				entries={detail.entries}
				unit={detail.unit}
				onEdit={(entry) => setEntryDialog({ mode: "edit", entry })}
				onDelete={setPendingEntry}
			/>

			<EntryFormDialog
				isOpen={entryDialog.mode !== "closed"}
				onOpenChange={(open) => {
					if (!open) setEntryDialog({ mode: "closed" });
				}}
				tracker={detail}
				entry={entryDialog.mode === "edit" ? entryDialog.entry : undefined}
				previousValue={previousValue}
				onSubmit={(values: EntryValues) => {
					if (entryDialog.mode === "edit") {
						queueUpdateEntry(detail, entryDialog.entry, values);
					} else {
						queueCreateEntry(detail, values);
					}
					setEntryDialog({ mode: "closed" });
				}}
			/>

			<TrackerFormDialog
				isOpen={isEditOpen}
				onOpenChange={setIsEditOpen}
				tracker={detail}
				onSubmit={(values: TrackerValues) => {
					queueUpdateTracker(detail, values);
					setIsEditOpen(false);
				}}
			/>

			<AlertDialog
				isOpen={pendingEntry !== null}
				onOpenChange={(open) => {
					if (!open) setPendingEntry(null);
				}}
				title="Delete this entry?"
				description={`The reading of ${pendingEntry?.value ?? ""} ${detail.unit} on ${formatDate(
					pendingEntry?.recordedAt,
				)} will be deleted when you save your changes.`}
				actionLabel="Delete"
				onAction={() => {
					if (pendingEntry) queueDeleteEntry(detail, pendingEntry);
					setPendingEntry(null);
				}}
			/>

			<AlertDialog
				isOpen={isDeletingTracker}
				onOpenChange={setIsDeletingTracker}
				title={`Delete ${detail.title}?`}
				description="The tracker and its whole progress history will be deleted when you save your changes."
				actionLabel="Delete"
				onAction={() => {
					queueDeleteTracker(detail);
					setIsDeletingTracker(false);
					void navigate({ to: "/trackers" });
				}}
			/>
		</VStack>
	);
}
