import { Divider } from "@astryxdesign/core/Divider";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { FormDialog } from "#/components/common/form-dialog";
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
			{ keys: [TASK_SHORTCUTS.backlog], what: "Backlog, in or out" },
			{ keys: [TASK_SHORTCUTS.urgent], what: "Urgent" },
			{ keys: [TASK_SHORTCUTS.important], what: "Important" },
			{ keys: [TASK_SHORTCUTS.complete], what: "Done" },
			{ keys: [TASK_SHORTCUTS.edit], what: "Edit — in a checklist" },
		],
	},
	{
		title: "Writing a task",
		rows: [
			{ keys: ["Enter"], what: "Add. One task per line" },
			{ keys: ["Shift", "Enter"], what: "New line" },
			{ keys: ["#"], what: "Tag it" },
			{ keys: ["Tab"], what: "Take the suggestion" },
		],
	},
	{
		title: "Anywhere",
		rows: [
			{ keys: ["Ctrl", "K"], what: "Search everything" },
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
		what: "Anything you might do goes in the Backlog. Out of your head, off today.",
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
		what: "Each morning pull a few things onto Today. It is a plan, not a store.",
	},
	{
		step: "Let it tell you",
		what: "The pace figures say what a day owes. Sort by most behind when time is short.",
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
										<HStack gap={1} vAlign="center">
											{row.keys.map((key) => (
												<Key key={key} label={key} />
											))}
										</HStack>
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
				<VStack gap={2}>
					<Text type="label" weight="semibold" color="secondary">
						How to work this
					</Text>
					<VStack gap={3}>
						{WORKFLOW.map((row) => (
							<VStack key={row.step} gap={0.5}>
								<Text weight="medium">{row.step}</Text>
								<Text type="supporting">{row.what}</Text>
							</VStack>
						))}
					</VStack>
				</VStack>
			</VStack>
		</FormDialog>
	);
}
