import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleDashed, Plus, X } from "lucide-react";
import { memo, useCallback, useState } from "react";
import {
	ITEM_KIND_ICONS,
	ItemPickerDialog,
	useItemDirectory,
} from "#/components/common/item-picker-dialog";
import { isItemDone } from "#/lib/depends";
import { findCachedTask } from "#/lib/optimistic";
import { ITEM_KINDS, type ItemRef } from "#/schemas/common";
import type { Task } from "#/schemas/task";

const same = (a: ItemRef, b: ItemRef) => a.kind === b.kind && a.id === b.id;

/**
 * What a task waits on: tasks, checklists, trackers and tags from anywhere,
 * each marked done or not. Picked the way search finds things. Until every one
 * is done the task cannot be completed; see `whyBlocked`.
 *
 * Memoised, like the dialog's other fields, so typing a title does not draw
 * it again.
 */
export const DependsField = memo(function DependsField({
	task,
	value,
	onChange,
}: {
	task: Pick<Task, "taskId" | "tagIds">;
	value: ReadonlyArray<ItemRef>;
	onChange: (next: Array<ItemRef>) => void;
}) {
	const queryClient = useQueryClient();
	const directory = useItemDirectory();
	const [isPicking, setIsPicking] = useState(false);

	const toggle = (item: ItemRef) =>
		onChange(
			value.some((each) => same(each, item))
				? value.filter((each) => !same(each, item))
				: [...value, item],
		);

	/*
	 * Nothing that could never be done first: the task itself, the checklist it
	 * is in and the tags it carries — each done only once it is — and any task
	 * already waiting on it.
	 */
	const home = findCachedTask(queryClient, task.taskId)?.checklistId ?? null;
	const isOffered = useCallback(
		(item: ItemRef) => {
			if (item.kind === "task") {
				if (item.id === task.taskId) return false;
				const other = findCachedTask(queryClient, item.id)?.task;
				return !(other?.dependsOn ?? []).some(
					(ref) => ref.kind === "task" && ref.id === task.taskId,
				);
			}
			if (item.kind === "checklist") return item.id !== home;
			if (item.kind === "tag") return !task.tagIds.includes(item.id);
			return true;
		},
		[queryClient, task.taskId, task.tagIds, home],
	);

	// Only what this person can see is listed; the rest stays as it was.
	const shown = value.flatMap((ref) => {
		const info = directory.find(ref);
		return info === null ? [] : [info];
	});

	return (
		<VStack gap={2}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<VStack gap={0}>
					<Text type="label" weight="semibold">
						Depends on
					</Text>
					<Text type="supporting">
						It can't be completed until these are done.
					</Text>
				</VStack>
				<Button
					label="Add"
					icon={<Plus aria-hidden />}
					variant="secondary"
					size="sm"
					onClick={() => setIsPicking(true)}
				/>
			</HStack>

			{shown.length === 0 ? null : (
				<VStack gap={0.5}>
					{shown.map((item) => {
						const isDone = isItemDone(queryClient, item) === true;
						return (
							<HStack
								key={`${item.kind}:${item.id}`}
								gap={2}
								vAlign="center"
								paddingBlock={0.5}
							>
								<Icon
									icon={ITEM_KIND_ICONS[item.kind]}
									size="sm"
									color="secondary"
								/>
								<span className="min-w-0 flex-1">
									<Text maxLines={1}>{item.label}</Text>
								</span>
								<HStack gap={1} vAlign="center">
									<Icon
										icon={isDone ? CircleCheck : CircleDashed}
										size="sm"
										color={isDone ? "success" : "secondary"}
									/>
									<Text type="supporting">{isDone ? "Done" : "Not done"}</Text>
								</HStack>
								<IconButton
									label={`Stop waiting on ${item.label}`}
									tooltip="Remove"
									variant="ghost"
									size="sm"
									icon={<X aria-hidden />}
									onClick={() => toggle({ kind: item.kind, id: item.id })}
								/>
							</HStack>
						);
					})}
				</VStack>
			)}

			<ItemPickerDialog
				isOpen={isPicking}
				onOpenChange={setIsPicking}
				title="Depends on"
				kinds={ITEM_KINDS}
				picked={value}
				onToggle={toggle}
				isOffered={isOffered}
			/>
		</VStack>
	);
});
