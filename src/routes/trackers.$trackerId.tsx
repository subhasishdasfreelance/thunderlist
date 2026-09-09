import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { BackButton } from "#/components/common/back-button";
import { LoadingState } from "#/components/common/loading-state";
import { PaceLabel } from "#/components/common/pace-label";
import { ProgressChart } from "#/components/common/progress-chart";
import { ProgressMeter } from "#/components/common/progress-meter";
import { SectionSpinner } from "#/components/common/section-spinner";
import { ErrorNotice } from "#/components/common/states";
import { VelocityStats } from "#/components/common/velocity-stats";
import { type ProgressView, ViewToggle } from "#/components/common/view-toggle";
import { EntryFormDialog } from "#/components/trackers/entry-form-dialog";
import { ProgressHistory } from "#/components/trackers/progress-history";
import { formatProgress } from "#/components/trackers/tracker-card";
import { TrackerFormDialog } from "#/components/trackers/tracker-form-dialog";
import {
	createEntry,
	type EntryValues,
	type TrackerValues,
	useApplyChange,
} from "#/lib/changes";
import { dayStart } from "#/lib/chart-points";
import { formatDate } from "#/lib/format-date";
import { elapsedFraction } from "#/lib/progress";
import { primeQuery } from "#/queries/prime";
import { trackerEntriesQuery, trackerQuery } from "#/queries/trackers";
import { type ProgressEntry, TRACKER_TYPE_LABELS } from "#/schemas/tracker";

export const Route = createFileRoute("/trackers/$trackerId")({
	/*
	 * Only the figures are waited for. The history is the long half of the read
	 * and nobody is blocked on it, so it is started here and not awaited — by the
	 * time the top of the screen has painted it is usually already in.
	 */
	loader: ({ context, params }) => {
		void context.queryClient.prefetchQuery(
			trackerEntriesQuery(params.trackerId),
		);

		return primeQuery(context.queryClient, trackerQuery(params.trackerId));
	},
	component: TrackerDetailPage,
});

type EntryDialogState =
	| { mode: "closed" }
	| { mode: "create" }
	| { mode: "edit"; entry: ProgressEntry };

function TrackerDetailPage() {
	const { trackerId } = Route.useParams();
	const navigate = useNavigate();
	const { apply } = useApplyChange();

	const [entryDialog, setEntryDialog] = useState<EntryDialogState>({
		mode: "closed",
	});
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [pendingEntry, setPendingEntry] = useState<ProgressEntry | null>(null);
	const [isDeletingTracker, setIsDeletingTracker] = useState(false);

	const { data, isPending, isError, error, refetch } = useQuery(
		trackerQuery(trackerId),
	);
	const history = useQuery(trackerEntriesQuery(trackerId));
	const entries = history.data ?? [];

	const [view, setView] = useState<ProgressView>("list");

	const detail = data ?? null;

	if (isError && detail === null) {
		return (
			<VStack gap={4}>
				<BackButton to="/trackers" label="Trackers" />
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			</VStack>
		);
	}

	if (isPending || !detail) {
		return (
			<VStack gap={4}>
				<BackButton to="/trackers" label="Trackers" />
				<LoadingState />
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
			? (entries[
					entries.findIndex(
						(entry) => entry.entryId === entryDialog.entry.entryId,
					) - 1
				]?.value ?? 0)
			: detail.currentValue;

	const addLabel =
		detail.type === "book" ? "Add reading progress" : "Add progress";

	return (
		<VStack gap={4}>
			<BackButton to="/trackers" label="Trackers" />

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
					button={{
						label: "Tracker actions",
						tooltip: "Tracker actions",
						variant: "ghost",
						isIconOnly: true,
						icon: <MoreHorizontal aria-hidden />,
					}}
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
				startDate={detail.startDate}
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

			<VStack gap={2}>
				<HStack gap={2} hAlign="between" vAlign="center">
					<Text type="label" weight="semibold">
						Progress History
					</Text>
					<ViewToggle
						view={view}
						onChange={setView}
						label="Show progress as a list or a graph"
					/>
				</HStack>

				{view === "chart" ? (
					<Card padding={3}>
						{history.isPending ? (
							<SectionSpinner label="Loading history…" />
						) : (
							<ProgressChart
								start={dayStart(detail.startDate)}
								end={
									detail.deadline === null ? null : dayStart(detail.deadline)
								}
								now={Date.now()}
								target={detail.targetValue}
								base={detail.startValue}
								current={detail.currentValue}
								points={entries.map((entry) => ({
									id: entry.entryId,
									at: dayStart(entry.recordedAt),
									value: entry.value,
								}))}
								startLabel={formatDate(detail.startDate)}
								endLabel={
									detail.deadline === null
										? "No deadline"
										: formatDate(detail.deadline)
								}
								summary={`${detail.currentValue} of ${detail.targetValue} ${detail.unit} since ${formatDate(detail.startDate)}`}
							/>
						)}
					</Card>
				) : (
					<ProgressHistory
						entries={entries}
						unit={detail.unit}
						isPending={history.isPending}
						onEdit={(entry) => setEntryDialog({ mode: "edit", entry })}
						onDelete={setPendingEntry}
					/>
				)}
			</VStack>

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
						apply({
							kind: "entry.update",
							trackerId,
							entryId: entryDialog.entry.entryId,
							patch: values,
						});
					} else {
						createEntry(apply, trackerId, values);
					}
					setEntryDialog({ mode: "closed" });
				}}
			/>

			<TrackerFormDialog
				isOpen={isEditOpen}
				onOpenChange={setIsEditOpen}
				tracker={detail}
				onSubmit={(values: TrackerValues) => {
					apply({ kind: "tracker.update", trackerId, patch: values });
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
					if (pendingEntry) {
						apply({
							kind: "entry.delete",
							trackerId,
							entryId: pendingEntry.entryId,
						});
					}
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
					apply({ kind: "tracker.delete", trackerId });
					setIsDeletingTracker(false);
					void navigate({ to: "/trackers" });
				}}
			/>
		</VStack>
	);
}
