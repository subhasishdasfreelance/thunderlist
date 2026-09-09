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
		rows: [{ keys: ["?"], what: "This" }],
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
			title="Shortcuts"
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

				<Text type="supporting">
					No keyboard? Every one of these is a button on the row.
				</Text>
			</VStack>
		</FormDialog>
	);
}
