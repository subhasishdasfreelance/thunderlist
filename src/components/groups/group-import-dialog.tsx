import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Check, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { COLOR_OPTIONS } from "#/components/tags/tag-form-dialog";
import { type OutlineChecklist, parseOutline } from "#/lib/outline";
import { pickableColor, type TagColor } from "#/schemas/tag";
import { MAX_TASKS_AT_ONCE } from "#/schemas/task";
import { GroupBadge } from "./group-card";

/** Mirrors the most a group holds; see `importGroupInputSchema`. */
const MAX_CHECKLISTS = 500;

const PLACEHOLDER = `# Python
## Async, typing, FastAPI
python asyncio gather and cancellation -i
fastapi middleware and error handling

# TypeScript
## Language depth, Node runtime
javascript closures and hoisting -i`;

export type GroupImportValues = {
	name: string;
	color: TagColor;
	checklists: Array<OutlineChecklist>;
};

/**
 * Make a group from a pasted Markdown outline: each `#` heading a checklist,
 * the `##` line under it its description, and every other line a task in it.
 * See `parseOutline`.
 */
export function GroupImportDialog({
	isOpen,
	onOpenChange,
	onSubmit,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	onSubmit: (values: GroupImportValues) => void;
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
	const { checklists, skipped } = parseOutline(text);
	const taskCount = checklists.reduce(
		(sum, each) => sum + each.tasks.length,
		0,
	);
	const tooMany =
		checklists.length > MAX_CHECKLISTS
			? `At most ${MAX_CHECKLISTS} checklists in a group.`
			: taskCount > MAX_TASKS_AT_ONCE
				? `At most ${MAX_TASKS_AT_ONCE.toLocaleString()} tasks at once.`
				: null;
	const canImport = trimmed !== "" && checklists.length > 0 && tooMany === null;

	function submit(event: FormEvent) {
		event.preventDefault();
		if (!canImport) return;
		onSubmit({ name: trimmed, color, checklists });
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			number={{ kind: "group", number: undefined }}
			title="Import group"
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

				<VStack gap={1}>
					<TextArea
						autoComplete="off"
						label="Outline"
						isRequired
						description="Each # heading becomes a checklist and the ## line under it its description. Every other line is a task — end one with -u, -i or -ui to flag it."
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
						{checklists.length === 0
							? "Paste an outline to see what it makes."
							: `${count(checklists.length, "checklist")} with ${count(taskCount, "task")}.`}
						{skipped > 0
							? ` ${count(skipped, "line")} above the first # heading will be left out.`
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
