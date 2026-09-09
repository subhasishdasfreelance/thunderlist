import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack } from "@astryxdesign/core/Stack";
import { CalendarCheck, Inbox, Star, Zap } from "lucide-react";
import type { TaskListName } from "#/schemas/task-list";

/**
 * What can be done to a task from its row, and the key that does it.
 *
 * The four quick actions are the ones done constantly — plan it, park it, mark
 * it pressing, mark it worth doing — so they are buttons on the row rather than
 * entries in a menu, and each carries the shortcut that fires it while the
 * pointer is over the row.
 */
export const TASK_SHORTCUTS = {
	today: "t",
	backlog: "b",
	urgent: "u",
	important: "i",
	complete: "x",
	edit: "e",
} as const;

export type TaskQuickActions = {
	/** `null` takes the task off whichever list it is on. */
	onSetList: (list: TaskListName | null) => void;
	onSetUrgent: (urgent: boolean) => void;
	onSetImportant: (important: boolean) => void;
};

/**
 * The two flags, before the checkbox.
 *
 * They sit at the start of the row because they are set and read constantly —
 * more often than anything on the right — and because reading left to right the
 * useful order is "how much does this matter, then what is it".
 *
 * A flag that is on is tinted: warm for urgent, which is about time running
 * out, and a highlight for important, which is not. Both are tints Astryx
 * already uses for those meanings, so they carry the same weight here as
 * everywhere else and stay contrast-checked in both schemes.
 */
export function TaskFlagButtons({
	title,
	urgent,
	important,
	actions,
}: {
	title: string;
	urgent: boolean;
	important: boolean;
	actions: Pick<TaskQuickActions, "onSetUrgent" | "onSetImportant">;
}) {
	return (
		<HStack gap={0} vAlign="center">
			<span className="thunderlist-flag" data-flag="urgent" data-on={urgent}>
				<IconButton
					label={urgent ? `${title} is urgent` : `Mark ${title} urgent`}
					tooltip={`${urgent ? "Urgent" : "Mark urgent"} (${TASK_SHORTCUTS.urgent})`}
					variant="ghost"
					size="sm"
					icon={<Zap aria-hidden />}
					onClick={() => actions.onSetUrgent(!urgent)}
				/>
			</span>

			<span
				className="thunderlist-flag"
				data-flag="important"
				data-on={important}
			>
				<IconButton
					label={
						important ? `${title} is important` : `Mark ${title} important`
					}
					tooltip={`${important ? "Important" : "Mark important"} (${TASK_SHORTCUTS.important})`}
					variant="ghost"
					size="sm"
					icon={<Star aria-hidden />}
					onClick={() => actions.onSetImportant(!important)}
				/>
			</span>
		</HStack>
	);
}

/**
 * Planning a task for today, at the end of the row.
 *
 * It toggles, and that is the whole control: the button that puts a task on
 * Today is the button that takes it off again. There is no separate "remove" —
 * it would do exactly what pressing the lit button already does, and a second
 * way to do one thing is a button that has to be explained.
 *
 * Parking something in the Backlog is a decision made far less often, so it is
 * in the menu rather than spending a button's width on every row forever.
 */
export function TodayButton({
	title,
	listState,
	actions,
}: {
	title: string;
	listState: TaskListName | null;
	actions: Pick<TaskQuickActions, "onSetList">;
}) {
	const isOnToday = listState === "today";

	return (
		<IconButton
			label={isOnToday ? `Take ${title} off Today` : `Plan ${title} for Today`}
			tooltip={`${isOnToday ? "On Today — press to take off" : "Add to Today"} (${TASK_SHORTCUTS.today})`}
			variant={isOnToday ? "primary" : "ghost"}
			size="sm"
			icon={<CalendarCheck aria-hidden />}
			onClick={() => actions.onSetList(isOnToday ? null : "today")}
		/>
	);
}

/** The Backlog entry for a row's overflow menu. */
export function backlogMenuItem(
	listState: TaskListName | null,
	actions: Pick<TaskQuickActions, "onSetList">,
) {
	const isOnBacklog = listState === "backlog";

	return {
		label: `${isOnBacklog ? "Take out of the Backlog" : "Move to Backlog"} (${TASK_SHORTCUTS.backlog})`,
		icon: <Inbox aria-hidden />,
		onClick: () => actions.onSetList(isOnBacklog ? null : "backlog"),
	};
}
