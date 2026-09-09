import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { createFileRoute } from "@tanstack/react-router";
import { TASK_SHORTCUTS } from "#/components/tasks/task-actions";

export const Route = createFileRoute("/shortcuts")({
	component: ShortcutsPage,
});

type Shortcut = { keys: Array<string>; what: string; where?: string };

type Group = { title: string; note: string; shortcuts: Array<Shortcut> };

const GROUPS: Array<Group> = [
	{
		title: "On a task",
		note: "Point at any task in any list and press a key. Nothing has to be selected first.",
		shortcuts: [
			{
				keys: [TASK_SHORTCUTS.today],
				what: "Plan it for Today, or take it off",
			},
			{
				keys: [TASK_SHORTCUTS.backlog],
				what: "Park it in the Backlog, or take it out",
			},
			{ keys: [TASK_SHORTCUTS.urgent], what: "Mark it urgent, or clear that" },
			{
				keys: [TASK_SHORTCUTS.important],
				what: "Mark it important, or clear that",
			},
			{ keys: [TASK_SHORTCUTS.complete], what: "Tick it off, or reopen it" },
			{
				keys: [TASK_SHORTCUTS.edit],
				what: "Edit the title and its tags",
				where: "in a checklist",
			},
		],
	},
	{
		title: "Writing a task",
		note: "In the add field at the top of any list.",
		shortcuts: [
			{
				keys: ["Enter"],
				what: "Add it — one task per line, so a pasted list lands as a list",
			},
			{
				keys: ["Shift", "Enter"],
				what: "Start another line instead of adding",
			},
			{
				keys: ["#"],
				what: "Start a tag; the ones you have are offered as you type",
			},
			{ keys: ["Tab"], what: "Take the suggested tag" },
			{ keys: ["Esc"], what: "Dismiss the suggestions" },
		],
	},
];

/** One key, drawn as a key. */
function Key({ label }: { label: string }) {
	return <kbd className="thunderlist-key">{label}</kbd>;
}

/**
 * Every shortcut, in one place.
 *
 * Shortcuts are only worth having if they can be found, and a shortcut you have
 * to discover by accident is one most people never use. This is linked from the
 * account menu and is a normal screen rather than a modal, so it can be left
 * open on a second monitor while the habit forms.
 *
 * On a phone there is no keyboard and no hovering, so the page says so rather
 * than listing keys that cannot be pressed — but it stays reachable, because
 * the same account often uses both.
 */
function ShortcutsPage() {
	return (
		<VStack gap={4}>
			<VStack gap={0.5}>
				<Heading level={1}>Keyboard shortcuts</Heading>
				<Text color="secondary">
					For the desktop app. Every one of these is also a button, so nothing
					here is the only way to do something.
				</Text>
			</VStack>

			{GROUPS.map((group) => (
				<VStack key={group.title} gap={2}>
					<VStack gap={0}>
						<Text type="label" weight="semibold">
							{group.title}
						</Text>
						<Text type="supporting">{group.note}</Text>
					</VStack>

					<Card padding={0}>
						<VStack gap={0} paddingInline={4} paddingBlock={2}>
							{group.shortcuts.map((shortcut, index) => (
								<div key={shortcut.what}>
									{index === 0 ? null : <Divider />}
									<HStack
										gap={3}
										hAlign="between"
										vAlign="center"
										paddingBlock={2}
										wrap="wrap"
									>
										<HStack gap={1} vAlign="center" wrap="wrap">
											<Text>{shortcut.what}</Text>
											{shortcut.where ? (
												<Text type="supporting">{shortcut.where}</Text>
											) : null}
										</HStack>
										<HStack gap={1} vAlign="center">
											{shortcut.keys.map((key) => (
												<Key key={key} label={key} />
											))}
										</HStack>
									</HStack>
								</div>
							))}
						</VStack>
					</Card>
				</VStack>
			))}

			<Text type="supporting">
				On a phone or tablet these do not apply: there is no pointer to rest on
				a task. Every action is a button on the row instead.
			</Text>
		</VStack>
	);
}
