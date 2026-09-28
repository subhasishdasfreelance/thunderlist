import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { LoadingState } from "#/components/common/loading-state";
import { stageColorStyle } from "#/components/common/stage-dot";
import { ErrorNotice } from "#/components/common/states";
import { CountdownFormDialog } from "#/components/countdowns/countdown-form-dialog";
import { useApplyChange } from "#/lib/changes";
import { formatDate, formatDateWithWeekday } from "#/lib/format-date";
import { createId, ID_PREFIX } from "#/lib/ids";
import { useNow } from "#/lib/use-now";
import { usePermissions } from "#/lib/use-team";
import { countdownsQuery } from "#/queries/countdowns";
import { primeQuery } from "#/queries/prime";
import { todayDateOnly } from "#/schemas/common";
import {
	type Countdown,
	type CountdownUnit,
	countdownParts,
	daysUntil,
	orderCountdowns,
} from "#/schemas/countdown";

export const Route = createFileRoute("/countdowns")({
	loader: ({ context }) => primeQuery(context.queryClient, countdownsQuery()),
	component: CountdownsPage,
});

/** A unit, after its number: "3 months", "1 day". */
const UNIT_NAMES: Record<CountdownUnit, [one: string, many: string]> = {
	years: ["year", "years"],
	months: ["month", "months"],
	weeks: ["week", "weeks"],
	days: ["day", "days"],
	hours: ["hour", "hours"],
	minutes: ["minute", "minutes"],
	seconds: ["second", "seconds"],
};

const unitName = (part: { unit: CountdownUnit; value: number }) =>
	UNIT_NAMES[part.unit][part.value === 1 ? 0 : 1];

/** The clock's units, which read as a clock: 04:12:09. */
const CLOCK_UNITS = new Set<CountdownUnit>(["hours", "minutes", "seconds"]);

/**
 * The time now, every second while `isTicking` — something on screen counts
 * seconds — and otherwise to the minute, as `useNow`. `null` until the
 * browser has it.
 */
function useTicking(isTicking: boolean): number | null {
	const minute = useNow();
	const [second, setSecond] = useState<number | null>(null);

	useEffect(() => {
		if (!isTicking) return;
		const tick = () => setSecond(Date.now());
		tick();
		const timer = setInterval(tick, 1000);
		return () => clearInterval(timer);
	}, [isTicking]);

	return isTicking ? (second ?? minute) : minute;
}

/**
 * Since when it has been counted — the day it was made — and how far along
 * that is: "Since 12th Sep, 2026 · 16 of 36 days" while it is ahead, the
 * whole stretch once it has come. Nothing for one made on or after its day.
 */
function sinceLabel(countdown: Countdown, today: string): string | null {
	const start = todayDateOnly(new Date(countdown.createdAt));
	const total = daysUntil(countdown.date, start);
	if (total <= 0) return null;

	const unit = total === 1 ? "day" : "days";
	return today < countdown.date
		? `Since ${formatDate(start)} · ${daysUntil(today, start)} of ${total} ${unit}`
		: `${total} ${unit}, counted from ${formatDate(start)}`;
}

/** One countdown as a tile: the time left, large, in its colour. */
function CountdownTile({
	countdown,
	now,
	onOpen,
}: {
	countdown: Countdown;
	/** `null` until the browser knows the viewer's clock; see `useNow`. */
	now: number | null;
	onOpen?: () => void;
}) {
	const today = now === null ? null : todayDateOnly(new Date(now));
	const days = today === null ? null : daysUntil(countdown.date, today);
	const since = today === null ? null : sinceLabel(countdown, today);
	const parts =
		now === null
			? []
			: countdownParts(countdown.date, now, countdown.format ?? "seconds");
	const ahead = days !== null && days > 0 ? "to go" : "ago";
	const calendar = parts.filter((part) => !CLOCK_UNITS.has(part.unit));
	const clock = parts
		.filter((part) => CLOCK_UNITS.has(part.unit))
		.map((part) => String(part.value).padStart(2, "0"))
		.join(":");

	const content = (
		<>
			{days === null || parts.length <= 1 ? (
				<>
					<span className="thunderlist-countdown-number">
						{days === null ? "–" : days === 0 ? "Today" : parts[0].value}
					</span>
					<span className="thunderlist-countdown-unit">
						{days === null
							? ""
							: days === 0
								? "It is the day"
								: `${unitName(parts[0])} ${ahead}`}
					</span>
				</>
			) : (
				<>
					{calendar.length === 0 ? null : (
						<span className="thunderlist-countdown-parts">
							{calendar.map((part) => (
								<span key={part.unit} className="thunderlist-countdown-part">
									<span className="thunderlist-countdown-number">
										{part.value}
									</span>
									<span className="thunderlist-countdown-part-unit">
										{unitName(part)}
									</span>
								</span>
							))}
						</span>
					)}
					{clock === "" ? null : (
						<span className="thunderlist-countdown-clock">{clock}</span>
					)}
					<span className="thunderlist-countdown-unit">{ahead}</span>
				</>
			)}
			<span className="thunderlist-countdown-title">{countdown.title}</span>
			<span className="thunderlist-countdown-date">
				{formatDateWithWeekday(countdown.date)}
			</span>
			{since === null ? null : (
				<span className="thunderlist-countdown-date">{since}</span>
			)}
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

	const { data, isPending, isError, error, refetch } = useQuery(
		countdownsQuery(),
	);
	const now = useTicking(
		(data ?? []).some((each) => (each.format ?? "seconds") === "seconds"),
	);
	const today = now === null ? null : todayDateOnly(new Date(now));
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
									now={now}
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
										now={now}
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
