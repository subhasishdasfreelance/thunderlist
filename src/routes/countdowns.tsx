import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { SelectButtons } from "#/components/common/arranged-list";
import { LoadingState } from "#/components/common/loading-state";
import { Pickable } from "#/components/common/pickable";
import { PickedItemsBar } from "#/components/common/picked-items-bar";
import { stageColorStyle } from "#/components/common/stage-dot";
import { ErrorNotice } from "#/components/common/states";
import { CountdownFormDialog } from "#/components/countdowns/countdown-form-dialog";
import { useApplyChange } from "#/lib/changes";
import { formatDate, formatDeadline } from "#/lib/format-date";
import { createId, ID_PREFIX } from "#/lib/ids";
import { useFocusRow } from "#/lib/use-focus-task";
import { useNow } from "#/lib/use-now";
import { usePickMode } from "#/lib/use-pick-mode";
import { useItemPermissions, usePermissions } from "#/lib/use-team";
import { countdownsQuery } from "#/queries/countdowns";
import { primeQuery } from "#/queries/prime";
import { todayDateOnly } from "#/schemas/common";
import {
	type Countdown,
	type CountdownUnit,
	countdownParts,
	daysUntil,
	orderCountdowns,
	ticksEverySecond,
} from "#/schemas/countdown";

export const Route = createFileRoute("/countdowns")({
	// The countdown to bring into view, when search sent you to one.
	validateSearch: (
		search: Record<string, unknown>,
	): { countdown?: string } => ({
		countdown:
			typeof search.countdown === "string" ? search.countdown : undefined,
	}),
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

/** A unit under its number in a segment, named short so four fit a row. */
const SEGMENT_LABELS: Record<CountdownUnit, [one: string, many: string]> = {
	years: ["yr", "yrs"],
	months: ["mo", "mos"],
	weeks: ["wk", "wks"],
	days: ["day", "days"],
	hours: ["hr", "hrs"],
	minutes: ["min", "min"],
	seconds: ["sec", "sec"],
};

const segmentLabel = (part: { unit: CountdownUnit; value: number }) =>
	SEGMENT_LABELS[part.unit][part.value === 1 ? 0 : 1];

/** The clock's units, two digits each, as on a clock: 05 hrs 09 min. */
const CLOCK_UNITS = new Set<CountdownUnit>(["hours", "minutes", "seconds"]);

/** `14400` → `14,400`: a count of seconds or minutes runs long. */
const formatCount = (value: number) => value.toLocaleString("en-US");

/** A segment's number: grouped, and two digits on a clock. */
const segmentNumber = (part: { unit: CountdownUnit; value: number }) =>
	CLOCK_UNITS.has(part.unit) && part.value < 10
		? String(part.value).padStart(2, "0")
		: formatCount(part.value);

/**
 * How many segments to a row: four, or three in two even rows for five or
 * six. A first number that runs long — 8,760 hours — takes the room four
 * would have had, so there are only as many as there are segments.
 */
function segmentColumns(
	parts: ReadonlyArray<{ unit: CountdownUnit; value: number }>,
): number {
	if (parts.length > 4) return 3;
	return segmentNumber(parts[0]).length > 3 ? parts.length : 4;
}

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
 * that is: "Since Sat, Sep 12, 2026 · 16 of 36 days" while it is ahead, the
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
	onOpen: openIfAllowed,
	isFocused = false,
}: {
	countdown: Countdown;
	/** `null` until the browser knows the viewer's clock; see `useNow`. */
	now: number | null;
	onOpen?: () => void;
	/** The one search sent you to; it is scrolled to and ringed. */
	isFocused?: boolean;
}) {
	// Opened to change only by whoever runs it; see `useItemPermissions`.
	const { canManageContent } = useItemPermissions(countdown.access);
	const onOpen = canManageContent ? openIfAllowed : undefined;
	const today = now === null ? null : todayDateOnly(new Date(now));
	const days = today === null ? null : daysUntil(countdown.date, today);
	const since = today === null ? null : sinceLabel(countdown, today);
	const parts =
		now === null
			? []
			: countdownParts(
					countdown.date,
					now,
					countdown.format ?? "seconds",
					countdown.time,
				);
	// On the day itself, only a time still to come is counted; see `countdownParts`.
	const ahead =
		days !== null && (days > 0 || (days === 0 && parts.length > 0))
			? "to go"
			: "ago";

	const single =
		days === null ? "–" : parts.length === 0 ? "Today" : formatCount(parts[0].value);

	const content = (
		<>
			{days === null || parts.length <= 1 ? (
				<>
					<span
						className="thunderlist-countdown-number"
						// Shrinks to fit a long count; see the stylesheet.
						style={{ "--thunderlist-chars": single.length } as CSSProperties}
					>
						{single}
					</span>
					<span className="thunderlist-countdown-unit">
						{days === null
							? ""
							: parts.length === 0
								? "It is the day"
								: `${unitName(parts[0])} ${ahead}`}
					</span>
				</>
			) : (
				<>
					{/* Each number over its unit: 1 day 05 hrs 49 min 30 sec. */}
					<span
						className="thunderlist-countdown-parts"
						data-columns={segmentColumns(parts)}
					>
						{parts.map((part) => (
							<span key={part.unit} className="thunderlist-countdown-part">
								<span className="thunderlist-countdown-number">
									{segmentNumber(part)}
								</span>
								<span className="thunderlist-countdown-part-unit">
									{segmentLabel(part)}
								</span>
							</span>
						))}
					</span>
					<span className="thunderlist-countdown-unit">{ahead}</span>
				</>
			)}
			<span className="thunderlist-countdown-title">{countdown.title}</span>
			<span className="thunderlist-countdown-date">
				{formatDeadline(countdown.date, countdown.time)}
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
			data-countdown-id={countdown.countdownId}
			data-focused={isFocused}
			style={stageColorStyle(countdown.color)}
		>
			{content}
		</div>
	) : (
		<button
			type="button"
			className="thunderlist-countdown"
			data-past={days !== null && days < 0}
			data-countdown-id={countdown.countdownId}
			data-focused={isFocused}
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
	// Several picked out, to change together; see `usePickMode`.
	const pick = usePickMode(canManageContent);
	const [isCreating, setIsCreating] = useState(false);
	const [editing, setEditing] = useState<Countdown | null>(null);

	const { countdown: focusId } = Route.useSearch();
	useFocusRow("data-countdown-id", focusId);
	const { data, isPending, isError, error, refetch } = useQuery(
		countdownsQuery(),
	);
	const now = useTicking(
		(data ?? []).some((each) => ticksEverySecond(each.format ?? "seconds")),
	);
	// Which have passed is a question for the viewer's clock, so the tiles wait
	// for the browser to have it; see `useNow`.
	const today = now === null ? null : todayDateOnly(new Date(now));
	const { upcoming, past } = orderCountdowns(data ?? [], today ?? "");

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
					<HStack gap={1} vAlign="center">
						{(data ?? []).length === 0 ? null : <SelectButtons mode={pick} />}
						<Button
							label="New countdown"
							variant="primary"
							icon={<Plus aria-hidden />}
							onClick={() => setIsCreating(true)}
						/>
					</HStack>
				) : null}
			</HStack>

			{isError ? (
				<ErrorNotice error={error} onRetry={() => void refetch()} />
			) : isPending || today === null ? (
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
								<Pickable
									key={countdown.countdownId}
									id={countdown.countdownId}
									isPicking={pick.isPicking}
									isPicked={pick.picked.has(countdown.countdownId)}
									label={countdown.title}
									onToggle={() => pick.toggle(countdown.countdownId)}
								>
									<CountdownTile
										countdown={countdown}
										now={now}
										onOpen={open(countdown)}
										isFocused={countdown.countdownId === focusId}
									/>
								</Pickable>
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
									<Pickable
										key={countdown.countdownId}
										id={countdown.countdownId}
										isPicking={pick.isPicking}
										isPicked={pick.picked.has(countdown.countdownId)}
										label={countdown.title}
										onToggle={() => pick.toggle(countdown.countdownId)}
									>
										<CountdownTile
											countdown={countdown}
											now={now}
											onOpen={open(countdown)}
											isFocused={countdown.countdownId === focusId}
										/>
									</Pickable>
								))}
							</div>
						</VStack>
					)}
				</VStack>
			)}

			{pick.isPicking ? (
				<PickedItemsBar
					of="countdown"
					items={(data ?? []).flatMap((countdown) =>
						pick.picked.has(countdown.countdownId)
							? [{ id: countdown.countdownId, access: countdown.access }]
							: [],
					)}
					onDone={pick.stop}
				/>
			) : null}

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
