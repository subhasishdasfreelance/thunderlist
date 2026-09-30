import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import {
	type Dispatch,
	memo,
	type SetStateAction,
	useCallback,
	useState,
} from "react";
import { createId, ID_PREFIX } from "#/lib/ids";
import type { Subtask } from "#/schemas/task";

/**
 * The steps a task is broken into: ticked, renamed, moved up and down and
 * removed here, and saved with the rest of the dialog; see `Task.subtasks`.
 *
 * New ones are typed into the box at the foot, Enter adding each and leaving
 * the box ready for the next, so a list goes in without reaching for the
 * pointer. A row left with no title is dropped on saving.
 *
 * Memoised, like the dialog's other fields, so typing a title does not draw
 * it again.
 */
export const SubtasksField = memo(function SubtasksField({
	value,
	onChange,
}: {
	value: ReadonlyArray<Subtask>;
	onChange: Dispatch<SetStateAction<Array<Subtask>>>;
}) {
	const [draft, setDraft] = useState("");
	const done = value.filter((subtask) => subtask.done).length;

	const update = useCallback(
		(index: number, patch: Partial<Subtask>) =>
			onChange((subtasks) =>
				subtasks.map((subtask, at) =>
					at === index ? { ...subtask, ...patch } : subtask,
				),
			),
		[onChange],
	);

	const move = useCallback(
		(index: number, by: -1 | 1) =>
			onChange((subtasks) => {
				const next = [...subtasks];
				const [subtask] = next.splice(index, 1);
				next.splice(index + by, 0, subtask);
				return next;
			}),
		[onChange],
	);

	const remove = useCallback(
		(index: number) =>
			onChange((subtasks) => subtasks.filter((_, at) => at !== index)),
		[onChange],
	);

	function add() {
		const title = draft.trim();
		if (title === "") return;
		onChange((subtasks) => [
			...subtasks,
			{ subtaskId: createId(ID_PREFIX.subtask), title, done: false },
		]);
		setDraft("");
	}

	return (
		<VStack gap={2}>
			<HStack gap={2} hAlign="between" vAlign="center">
				<VStack gap={0}>
					<Text type="label" weight="semibold">
						Subtasks
					</Text>
					<Text type="supporting">
						{value.length === 0
							? "Break it into steps. It can't be completed until every one is done."
							: `${done} of ${value.length} done. It can't be completed until every one is.`}
					</Text>
				</VStack>
				{done === 0 ? null : (
					<Button
						label="Delete completed"
						icon={<Trash2 aria-hidden />}
						variant="ghost"
						size="sm"
						onClick={() =>
							onChange((subtasks) =>
								subtasks.filter((subtask) => !subtask.done),
							)
						}
					/>
				)}
			</HStack>

			{value.length === 0 ? null : (
				<VStack gap={1}>
					{value.map((subtask, index) => (
						<SubtaskRow
							key={subtask.subtaskId}
							subtask={subtask}
							index={index}
							isLast={index === value.length - 1}
							onUpdate={update}
							onMove={move}
							onRemove={remove}
						/>
					))}
				</VStack>
			)}

			<HStack gap={1} vAlign="center">
				<span className="min-w-0 flex-1">
					<TextInput
						// A search field, so Chrome on Android keeps its bar of saved
						// passwords, cards and addresses off the keyboard; see
						// `SearchDialog`.
						type={"search" as "text"}
						autoComplete="off"
						label="New subtask"
						isLabelHidden
						placeholder="Add a subtask"
						enterKeyHint="enter"
						value={draft}
						onChange={setDraft}
						onKeyDown={(event) => {
							// Enter adds it, rather than saving the dialog.
							if (event.key === "Enter") {
								event.preventDefault();
								add();
							}
						}}
						width="100%"
					/>
				</span>
				<IconButton
					label="Add subtask"
					tooltip="Add"
					icon={<Plus aria-hidden />}
					variant="secondary"
					size="sm"
					isDisabled={draft.trim() === ""}
					onClick={add}
				/>
			</HStack>
		</VStack>
	);
});

/** One subtask: its tick, its title, and the buttons that move or remove it. */
const SubtaskRow = memo(function SubtaskRow({
	subtask,
	index,
	isLast,
	onUpdate,
	onMove,
	onRemove,
}: {
	subtask: Subtask;
	index: number;
	isLast: boolean;
	onUpdate: (index: number, patch: Partial<Subtask>) => void;
	onMove: (index: number, by: -1 | 1) => void;
	onRemove: (index: number) => void;
}) {
	const name = subtask.title || "this subtask";

	return (
		// Wraps, so on a narrow phone the title keeps its room and the three
		// buttons take the line below.
		<div className="flex flex-wrap items-center gap-1">
			<span className="flex min-w-40 flex-1 items-center gap-2">
				<CheckboxInput
					label={`Done: ${name}`}
					isLabelHidden
					value={subtask.done}
					onChange={(isDone) => onUpdate(index, { done: isDone })}
				/>
				<span className="min-w-0 flex-1">
					<TextInput
						// A search field, as the box for a new one is; its key only
						// finishes typing.
						type={"search" as "text"}
						autoComplete="off"
						label={`Subtask ${index + 1}`}
						isLabelHidden
						placeholder="Subtask"
						enterKeyHint="done"
						value={subtask.title}
						onChange={(title) => onUpdate(index, { title })}
						onKeyDown={(event) => {
							// Enter finishes typing; it does not save the dialog under it.
							if (event.key === "Enter") event.preventDefault();
						}}
						width="100%"
					/>
				</span>
			</span>
			<IconButton
				label={`Move ${name} up`}
				icon={<ArrowUp aria-hidden />}
				variant="ghost"
				size="sm"
				isDisabled={index === 0}
				onClick={() => onMove(index, -1)}
			/>
			<IconButton
				label={`Move ${name} down`}
				icon={<ArrowDown aria-hidden />}
				variant="ghost"
				size="sm"
				isDisabled={isLast}
				onClick={() => onMove(index, 1)}
			/>
			<IconButton
				label={`Delete ${name}`}
				icon={<X aria-hidden />}
				variant="ghost"
				size="sm"
				onClick={() => onRemove(index)}
			/>
		</div>
	);
});
