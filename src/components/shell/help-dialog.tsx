import { Divider } from "@astryxdesign/core/Divider";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { FormDialog } from "#/components/common/form-dialog";
import { PAGE_SHORTCUTS } from "#/components/shell/nav-items";
import { TASK_SHORTCUTS } from "#/components/tasks/task-actions";

type Row = { keys: Array<string>; what: string };

type Group = { title: string; rows: Array<Row> };

/**
 * Deliberately terse.
 *
 * A help panel people actually read is one they can finish. Each line is a key
 * and the shortest true description of what it does; anything that needed a
 * sentence would be a sign the thing itself needs changing.
 */
const GROUPS: Array<Group> = [
	{
		title: "On a task you point at",
		rows: [
			{ keys: [TASK_SHORTCUTS.today], what: "Today, on or off" },
			{ keys: [TASK_SHORTCUTS.backlog], what: "Move to the Backlog" },
			{ keys: [TASK_SHORTCUTS.urgent], what: "Urgent" },
			{ keys: [TASK_SHORTCUTS.important], what: "Important" },
			{ keys: [TASK_SHORTCUTS.complete], what: "Tick: next stage, or done" },
			{ keys: [TASK_SHORTCUTS.edit], what: "Edit" },
			{
				keys: [TASK_SHORTCUTS.type.toUpperCase()],
				what: "Type — bug, feature…",
			},
			{ keys: [TASK_SHORTCUTS.tag], what: "Tag it, picked from the list" },
			{ keys: ["Space"], what: "Assign to me, or unassign me — in a team" },
		],
	},
	{
		title: "On a tracker reading you point at",
		rows: [{ keys: [TASK_SHORTCUTS.edit], what: "Edit" }],
	},
	{
		title: "Several tasks at once",
		rows: [
			{
				keys: ["Drag"],
				what: "Select across rows to pick them — press and hold on a phone",
			},
			{ keys: ["Esc"], what: "Drop the pick" },
		],
	},
	{
		title: "Writing a task",
		rows: [
			{ keys: ["Enter"], what: "Add. One task per line" },
			{ keys: ["Shift", "Enter"], what: "New line" },
			{ keys: ["#"], what: "Tag it" },
			{
				keys: ["-u", "-i", "-ui"],
				what: "At the end: urgent, important, both",
			},
			{ keys: ["Tab"], what: "Take the suggestion" },
		],
	},
	{
		title: "Going somewhere",
		rows: PAGE_SHORTCUTS.map((page) => ({
			keys: [page.key],
			what: page.label,
		})),
	},
	{
		title: "Anywhere",
		rows: [
			{ keys: ["Ctrl", "K"], what: "Search everything" },
			{ keys: ["Ctrl", "Z"], what: "Undo the last thing you did to a task" },
			{
				keys: ["Esc"],
				what: "Leave a field, then close a popup, then close messages",
			},
			{ keys: ["?"], what: "This" },
		],
	},
];

/**
 * How the pieces fit together, in five lines.
 *
 * The shortcuts say what each key does; none of them say what the app is for.
 * Someone opening this on their first day needs the shape of the thing more
 * than they need a key list, and the shape is small enough to fit here — if it
 * needed a page, it would be a sign the app itself was too complicated.
 */
const WORKFLOW: Array<{ step: string; what: string }> = [
	{
		step: "Park it",
		what: "Anything you might do goes in the Backlog checklist: press B, or use a task's menu. Out of your head, off today.",
	},
	{
		step: "Group it",
		what: "Work with an end goes in a Checklist, with a start date and a deadline.",
	},
	{
		step: "Measure it",
		what: "A goal counted in pages, sessions or kilometres is a Tracker, not a list.",
	},
	{
		step: "Pick today",
		what: "Each morning press the bolt on a few tasks to put them on #today. It is a plan, not a store.",
	},
	{
		step: "Let it tell you",
		what: "The pace figures say what a day owes. Sort by most behind when time is short.",
	},
	{
		step: "Move it along",
		what: "Give a checklist stages — To do, Review, Done — when you edit it. Its tasks show a stage at a time; ticking one sends it to the next, and Stage in its menu to any.",
	},
	{
		step: "Narrow it down",
		what: "The filter row above a checklist's tasks shows one tag's, or one person's. The figures and the chart follow it.",
	},
	{
		step: "Say what it is",
		what: "Press K on a task for its type: bug, feature, chore. Manage types from there.",
	},
];

/**
 * Working with other people, in the order it happens. A team is the one part
 * of the app with rules someone else sets, so the rules are said here too.
 */
const TEAMWORK: Array<{ step: string; what: string }> = [
	{
		step: "Make a team",
		what: "Settings → New team. You are its admin: the one person who adds people, gives them roles and can delete it.",
	},
	{
		step: "Add people",
		what: "Settings → open the team → Add someone, by the address they sign in with, as a project manager, collaborator or viewer.",
	},
	{
		step: "Know the roles",
		what: "Project managers add, delete and organise the work; collaborators tick, move and update the tasks; viewers see everything and change nothing. A team's popup has the full table.",
	},
	{
		step: "Switch spaces",
		what: "Settings → Work here. Personal is just you; each team is a space of its own, with its own lists.",
	},
	{
		step: "Share only some of it",
		what: "The faces beside Back on a checklist, tag or tracker are who can see it. Press them to change who.",
	},
	{
		step: "Hand work out",
		what: "Point at a task and press Space to take it on, or Assign people… from its menu. The person filter shows whose is whose.",
	},
];

function Key({ label }: { label: string }) {
	return <kbd className="thunderlist-key">{label}</kbd>;
}

/**
 * Every shortcut, one keypress away.
 *
 * A dialog rather than a page: it is read while doing something else, and
 * leaving the screen to learn a shortcut for that screen is the wrong trade.
 */
export function HelpDialog({
	isOpen,
	onOpenChange,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}) {
	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title="Shortcuts and how to work this"
			subtitle="Point at a task and press a key."
			width={460}
		>
			<VStack gap={3}>
				{GROUPS.map((group) => (
					<VStack key={group.title} gap={1}>
						<Text type="label" weight="semibold" color="secondary">
							{group.title}
						</Text>

						<VStack gap={0}>
							{group.rows.map((row, index) => (
								<div key={row.what}>
									{index === 0 ? null : <Divider />}
									<HStack
										gap={3}
										hAlign="between"
										vAlign="center"
										paddingBlock={1}
									>
										<Text>{row.what}</Text>
										{/* Never squeezed: the description wraps instead. */}
										<span className="flex shrink-0 items-center gap-1">
											{row.keys.map((key) => (
												<Key key={key} label={key} />
											))}
										</span>
									</HStack>
								</div>
							))}
						</VStack>
					</VStack>
				))}

				{/* With the shortcuts it is about, not after the guide. */}
				<Text type="supporting">
					No keyboard? Every one of these is a button on the row.
				</Text>

				<Divider />

				{/*
				 * One column: each idea named, then said. Side by side, the names
				 * pushed the sentences into a narrow column of short ragged lines.
				 */}
				{[
					{ title: "How to work this", rows: WORKFLOW },
					{ title: "Working in a team", rows: TEAMWORK },
				].map((guide, index) => (
					<VStack key={guide.title} gap={3}>
						{index === 0 ? null : <Divider />}
						<VStack gap={2}>
							<Text type="label" weight="semibold" color="secondary">
								{guide.title}
							</Text>
							<VStack gap={3}>
								{guide.rows.map((row) => (
									<VStack key={row.step} gap={0.5}>
										<Text weight="medium">{row.step}</Text>
										<Text type="supporting">{row.what}</Text>
									</VStack>
								))}
							</VStack>
						</VStack>
					</VStack>
				))}
			</VStack>
		</FormDialog>
	);
}
