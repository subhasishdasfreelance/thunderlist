import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Check, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { TextArea, TextInput } from "#/components/common/text-fields";
import { COLOR_OPTIONS } from "#/components/tags/tag-form-dialog";
import {
	type OutlineChecklist,
	type OutlineTracker,
	parseOutline,
} from "#/lib/outline";
import type { Group } from "#/schemas/group";
import { pickableColor, type TagColor } from "#/schemas/tag";
import { MAX_TASKS_AT_ONCE } from "#/schemas/task";
import { GroupBadge } from "./group-card";

/** Mirrors the most a group holds; see `importGroupInputSchema`. */
const MAX_ITEMS = 500;

const PLACEHOLDER = `# Python
## Async, typing, FastAPI
python asyncio gather and cancellation -i
fastapi middleware and error handling

# TypeScript
## Language depth, Node runtime
javascript closures and hoisting -i

# &Clean Code -i
target: 464 pages
start: 40
type: book
deadline: 2026-12-01
## One chapter a day`;

export type GroupImportValues = {
	name: string;
	color: TagColor;
	checklists: Array<OutlineChecklist>;
	trackers: Array<OutlineTracker>;
};

/**
 * Make a group from a pasted Markdown outline: each `#` heading a checklist,
 * the `##` line under it its description, and every other line a task in it;
 * each `# &` heading a tracker, with its target and other settings on the
 * lines under it. See `parseOutline`.
 *
 * Given a `group`, the outline's checklists go into that one instead, so only
 * the outline is asked for.
 */
export function GroupImportDialog({
	isOpen,
	onOpenChange,
	onSubmit,
	group,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	onSubmit: (values: GroupImportValues) => void;
	group?: Group;
}) {
	const [name, setName] = useState("");
	const [color, setColor] = useState<TagColor>("blue");
	const [text, setText] = useState("");

	useEffect(() => {
		if (!isOpen) return;
		setName("");
		setColor("blue");
		setText("");
	}, [isOpen]);

	const trimmed = name.trim();
	const { checklists, trackers, skipped, untargeted } = parseOutline(text);
	const taskCount = checklists.reduce(
		(sum, each) => sum + each.tasks.length,
		0,
	);
	const itemCount = checklists.length + trackers.length;
	const room = MAX_ITEMS - (group?.items.length ?? 0);
	const tooMany =
		itemCount > room
			? group === undefined
				? `At most ${MAX_ITEMS} things in a group.`
				: `At most ${MAX_ITEMS} things in a group; this one has room for ${room.toLocaleString()} more.`
			: taskCount > MAX_TASKS_AT_ONCE
				? `At most ${MAX_TASKS_AT_ONCE.toLocaleString()} tasks at once.`
				: null;
	const canImport =
		(group !== undefined || trimmed !== "") &&
		itemCount > 0 &&
		tooMany === null;

	function submit(event: FormEvent) {
		event.preventDefault();
		if (!canImport) return;
		onSubmit({ name: trimmed, color, checklists, trackers });
	}

	const made = [
		...(checklists.length === 0
			? []
			: [
					`${count(checklists.length, "checklist")} with ${count(taskCount, "task")}`,
				]),
		...(trackers.length === 0 ? [] : [count(trackers.length, "tracker")]),
	].join(" and ");

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			number={{ kind: "group", number: group?.number }}
			title={group === undefined ? "Import group" : `Import into ${group.name}`}
			onSubmit={submit}
			actions={(formId) => (
				<HStack gap={2} hAlign="end">
					<Button
						label="Cancel"
						icon={<X aria-hidden />}
						variant="ghost"
						onClick={() => onOpenChange(false)}
					/>
					<Button
						label="Import"
						icon={<Check aria-hidden />}
						variant="primary"
						type="submit"
						form={formId}
						isDisabled={!canImport}
					/>
				</HStack>
			)}
		>
			<VStack gap={4}>
				{group === undefined ? (
					<>
						<HStack gap={3} vAlign="end">
							<GroupBadge group={{ color }} size="lg" />
							<span className="min-w-0 flex-1">
								<TextInput
									autoComplete="off"
									label="Name"
									isRequired
									value={name}
									onChange={setName}
									placeholder="Interview prep, Q4…"
									width="100%"
								/>
							</span>
						</HStack>

						<Selector
							label="Colour"
							options={COLOR_OPTIONS}
							value={pickableColor(color)}
							onChange={(next) => setColor(next as TagColor)}
						/>
					</>
				) : null}

				<VStack gap={1}>
					<TextArea
						autoComplete="off"
						label="Outline"
						isRequired
						description="Each # heading becomes a checklist and the ## line under it its description. Every other line is a task — end one with -u, -i or -ui to flag it. A # &heading becomes a tracker: give it a target: line (a number and its unit), and start:, type: (book, course, project, fitness, custom) or deadline: if wanted."
						rows={10}
						value={text}
						onChange={setText}
						placeholder={PLACEHOLDER}
						hasSpellCheck={false}
						width="100%"
						status={
							tooMany === null ? undefined : { type: "error", message: tooMany }
						}
					/>
					<Text type="supporting">
						{itemCount === 0
							? "Paste an outline to see what it makes."
							: `${made}.`}
						{skipped > 0
							? ` ${count(skipped, "line")} will be left out: above the first # heading, or not a setting under a tracker.`
							: ""}
						{untargeted > 0
							? ` ${count(untargeted, "tracker")} with no target: line will be left out.`
							: ""}
					</Text>
				</VStack>
			</VStack>
		</FormDialog>
	);
}

function count(n: number, noun: string): string {
	return `${n.toLocaleString()} ${noun}${n === 1 ? "" : "s"}`;
}
