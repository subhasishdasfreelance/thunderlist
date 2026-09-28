import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { LoadingState } from "#/components/common/loading-state";
import { stageColorStyle } from "#/components/common/stage-dot";
import { ErrorNotice } from "#/components/common/states";
import { CountdownFormDialog } from "#/components/countdowns/countdown-form-dialog";
import { useApplyChange } from "#/lib/changes";
import { formatDateWithWeekday } from "#/lib/format-date";
import { createId, ID_PREFIX } from "#/lib/ids";
import { useNow } from "#/lib/use-now";
import { usePermissions } from "#/lib/use-team";
import { countdownsQuery } from "#/queries/countdowns";
import { primeQuery } from "#/queries/prime";
import { todayDateOnly } from "#/schemas/common";
import {
	type Countdown,
	daysUntil,
	orderCountdowns,
} from "#/schemas/countdown";

export const Route = createFileRoute("/countdowns")({
	loader: ({ context }) => primeQuery(context.queryClient, countdownsQuery()),
	component: CountdownsPage,
});

/** What the big number is followed by. */
function daysLabel(days: number): string {
	if (days === 0) return "It is the day";
	const count = Math.abs(days);
	const unit = count === 1 ? "day" : "days";
	return days > 0 ? `${unit} to go` : `${unit} ago`;
}

/** One countdown as a tile: the number of days, large, in its colour. */
function CountdownTile({
	countdown,
	today,
	onOpen,
}: {
	countdown: Countdown;
	/** `null` until the browser knows the viewer's day; see `useNow`. */
	today: string | null;
	onOpen?: () => void;
}) {
	const days = today === null ? null : daysUntil(countdown.date, today);
	const content = (
		<>
			<span className="thunderlist-countdown-number">
				{days === null ? "–" : days === 0 ? "Today" : Math.abs(days)}
			</span>
			<span className="thunderlist-countdown-unit">
				{days === null ? "" : daysLabel(days)}
			</span>
			<span className="thunderlist-countdown-title">{countdown.title}</span>
			<span className="thunderlist-countdown-date">
				{formatDateWithWeekday(countdown.date)}
			</span>
		</>
	);

	return onOpen === undefined ? (
		<div
			className="thunderlist-countdown"
			data-past={days !== null && days < 0}
			style={stageColorStyle(countdown.color)}
		>
			{content}
		</div>
	) : (
		<button
			type="button"
			className="thunderlist-countdown"
			data-past={days !== null && days < 0}
			style={stageColorStyle(countdown.color)}
			title={`Edit ${countdown.title}`}
			onClick={onOpen}
		>
			{content}
		</button>
	);
}

/**
 * Countdowns: the days the work is heading for, and how many are left to
 * each. A tile each, the soonest first; the ones already past follow, fainter.
 * Pressing one opens it to change or delete.
 */
function CountdownsPage() {
	const { apply } = useApplyChange();
	const { canManageContent } = usePermissions();
	const [isCreating, setIsCreating] = useState(false);
	const [editing, setEditing] = useState<Countdown | null>(null);

	const now = useNow();
	const today = now === null ? null : todayDateOnly(new Date(now));

	const { data, isPending, isError, error, refetch } = useQuery(
		countdownsQuery(),
	);
	const { upcoming, past } = orderCountdowns(
		data ?? [],
		today ?? todayDateOnly(),
	);

	const open = (countdown: Countdown) =>
		canManageContent ? () => setEditing(countdown) : undefined;

	return (
		<VStack gap={4}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<VStack gap={0.5}>
					<Heading level={1}>Countdowns</Heading>
					<Text color="secondary">The days you are heading for.</Text>
				</VStack>
				{canManageContent ? (
					<Button
						label="New countdown"
						variant="primary"
						icon={<Plus aria-hidden />}
						onClick={() => setIsCreating(true)}
					/>
				) : null}
			</HStack>

			{isError ? (
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			) : isPending ? (
				<LoadingState />
			) : upcoming.length === 0 && past.length === 0 ? (
				<EmptyState
					title="No countdowns yet."
					description="Add a day — a launch, a trip, a review — and see how many days are left."
				/>
			) : (
				<VStack gap={4}>
					{upcoming.length === 0 ? null : (
						<div className="thunderlist-countdown-grid">
							{upcoming.map((countdown) => (
								<CountdownTile
									key={countdown.countdownId}
									countdown={countdown}
									today={today}
									onOpen={open(countdown)}
								/>
							))}
						</div>
					)}
					{past.length === 0 ? null : (
						<VStack gap={2}>
							<Text type="label" weight="semibold" color="secondary">
								Past
							</Text>
							<div className="thunderlist-countdown-grid">
								{past.map((countdown) => (
									<CountdownTile
										key={countdown.countdownId}
										countdown={countdown}
										today={today}
										onOpen={open(countdown)}
									/>
								))}
							</div>
						</VStack>
					)}
				</VStack>
			)}

			<CountdownFormDialog
				isOpen={isCreating}
				onOpenChange={setIsCreating}
				onSubmit={(values) => {
					apply({
						kind: "countdown.create",
						countdownId: createId(ID_PREFIX.countdown),
						...values,
					});
					setIsCreating(false);
				}}
			/>

			<CountdownFormDialog
				isOpen={editing !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setEditing(null);
				}}
				countdown={editing ?? undefined}
				onSubmit={(values) => {
					if (editing) {
						apply({
							kind: "countdown.update",
							countdownId: editing.countdownId,
							patch: values,
						});
					}
					setEditing(null);
				}}
				onDelete={() => {
					if (editing) {
						apply({
							kind: "countdown.delete",
							countdownId: editing.countdownId,
						});
					}
					setEditing(null);
				}}
			/>
		</VStack>
	);
}
