import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { VStack } from "@astryxdesign/core/Stack";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Token } from "@astryxdesign/core/Token";
import { Check, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { useTaskTypes } from "#/lib/use-task-types";
import { usePermissions } from "#/lib/use-team";
import type { Task } from "#/schemas/task";
import { TaskTypesDialog } from "./task-types-dialog";

/**
 * Say what kind of work a task is — K, while pointing at it.
 *
 * The space's list, with a filter above it, as a checklist is picked to move a
 * task into: two letters and Enter is quicker than finding the row. Picking
 * the type it already has, or "No type", takes it off.
 *
 * The list itself can be opened from here, for whoever may change it, so a
 * type that is missing can be added without leaving the task. It lives on the
 * Settings screen.
 */
export function TaskTypeDialog({
	isOpen,
	onOpenChange,
	task,
	onPick,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	task: Pick<Task, "title" | "typeId"> | null;
	onPick: (typeId: string | null) => void;
}) {
	const types = useTaskTypes();
	const { canManageContent } = usePermissions();
	const [query, setQuery] = useState("");
	const [isManaging, setIsManaging] = useState(false);

	// A fresh filter every time it opens.
	useEffect(() => {
		if (isOpen) setQuery("");
	}, [isOpen]);

	const needle = query.trim().toLowerCase();
	const shown = types.filter((type) =>
		type.name.toLowerCase().includes(needle),
	);
	const current = task?.typeId ?? null;

	const pick = (typeId: string | null) =>
		onPick(typeId === current ? null : typeId);

	return (
		<>
			<FormDialog
				isOpen={isOpen}
				onOpenChange={onOpenChange}
				title="Type"
				subtitle={task?.title}
				width={380}
				actions={
					canManageContent
						? () => (
								<Button
									label="Manage types"
									icon={<Settings aria-hidden />}
									variant="ghost"
									onClick={() => {
										onOpenChange(false);
										setIsManaging(true);
									}}
								/>
							)
						: undefined
				}
			>
				<VStack gap={3}>
					<TextInput
						autoComplete="off"
						label="Find a type"
						isLabelHidden
						placeholder="Find a type, then Enter"
						// Opened from the keyboard, so the keyboard carries on here.
						hasAutoFocus
						value={query}
						onChange={setQuery}
						onEnter={() => {
							if (shown.length > 0) pick(shown[0].typeId);
						}}
						width="100%"
					/>

					{shown.length === 0 ? (
						<EmptyState
							isCompact
							title="No matches"
							description={
								types.length === 0
									? "This space has no task types."
									: `No type matches "${query.trim()}".`
							}
						/>
					) : (
						// A space may have thirty types; the list scrolls, the field stays.
						<List hasDividers className="thunderlist-picker-list">
							{shown.map((type) => (
								<ListItem
									key={type.typeId}
									isSelected={type.typeId === current}
									onClick={() => pick(type.typeId)}
									label={
										<Token size="sm" color={type.color} label={type.name} />
									}
									endContent={
										type.typeId === current ? (
											<Icon icon={Check} size="sm" color="accent" />
										) : undefined
									}
								/>
							))}
							{current === null ? null : (
								<ListItem label="No type" onClick={() => onPick(null)} />
							)}
						</List>
					)}
				</VStack>
			</FormDialog>

			<TaskTypesDialog isOpen={isManaging} onOpenChange={setIsManaging} />
		</>
	);
}
