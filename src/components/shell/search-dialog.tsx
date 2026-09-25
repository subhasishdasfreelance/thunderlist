import { EmptyState } from "@astryxdesign/core/EmptyState";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { StageDot, stageColorStyle } from "#/components/common/stage-dot";
import { searchIndexQuery } from "#/queries/system";
import { tagsQuery } from "#/queries/tags";
import { checklistStages, stageColor } from "#/schemas/checklist";
import { type TagColor, tagParam, tagsFor } from "#/schemas/tag";

type Result = {
	key: string;
	label: string;
	context: string;
	to: string;
	/**
	 * The task to bring into view once the page opens, if this result is one.
	 * The page it lands on scrolls to it and rings it; see `useFocusTask`.
	 */
	taskId?: string;
	/**
	 * For a task, the stage it is at in its checklist, in that stage's colour —
	 * `null` for the first stage, which has none; see `stageColor`.
	 */
	stage?: { name: string; color: TagColor | null };
};

const MAX_PER_GROUP = 6;

function matches(haystack: string, needle: string): boolean {
	return haystack.toLowerCase().includes(needle);
}

/**
 * Search, from the keyboard as much as the pointer.
 *
 * The box is a combobox over the results: ↑ and ↓ move through them, Enter
 * opens the one lit, and Esc leaves the box and then closes the dialog. Focus
 * never leaves the box: the lit result is announced from it, as a combobox
 * does.
 */
export function SearchDialog({
	isOpen,
	onOpenChange,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}) {
	const [query, setQuery] = useState("");
	const [active, setActive] = useState(0);
	const navigate = useNavigate();
	const listId = useId();

	// Only loaded once the dialog is opened; filtering happens on the client.
	const { data, isPending, isError } = useQuery({
		...searchIndexQuery(),
		enabled: isOpen,
	});
	// Where a task in no checklist is shown: the page of a tag it carries.
	const tags = useQuery({ ...tagsQuery(), enabled: isOpen });

	const results = useMemo<Array<Result>>(() => {
		const needle = query.trim().toLowerCase();
		if (!data || needle === "") return [];

		const checklists = data.checklists
			.filter((item) => matches(item.title, needle))
			.slice(0, MAX_PER_GROUP)
			.map((item) => ({
				key: `chk-${item.checklistId}`,
				label: item.title,
				context: "Checklist",
				to: `/checklists/${item.checklistId}`,
			}));

		const trackers = data.trackers
			.filter(
				(item) =>
					matches(item.title, needle) ||
					(item.author !== null && matches(item.author, needle)),
			)
			.slice(0, MAX_PER_GROUP)
			.map((item) => ({
				key: `trk-${item.trackerId}`,
				label: item.title,
				context: item.caption ? `Tracker · ${item.caption}` : "Tracker",
				to: `/trackers/${item.trackerId}`,
			}));

		/*
		 * A task result opens the page the task is actually on and scrolls to it:
		 * its checklist, or — for one that belongs to no checklist — the page of
		 * the first tag it carries. A task with neither has nowhere to be shown,
		 * so it is not offered rather than opening a page it is not on.
		 */
		const tasks = data.tasks
			.filter((item) => matches(item.title, needle))
			.slice(0, MAX_PER_GROUP)
			.flatMap((item) => {
				const home =
					item.checklistId === null
						? (tagsFor(item.tagIds, tags.data ?? [])[0] ?? null)
						: null;
				const to =
					item.checklistId !== null
						? `/checklists/${item.checklistId}`
						: home !== null
							? `/tags/${tagParam(home)}`
							: null;

				if (to === null) return [];

				const stages = checklistStages(
					data.checklists.find(
						(checklist) => checklist.checklistId === item.checklistId,
					) ?? {},
				);
				const at = stages.findIndex((stage) => stage.stageId === item.stageId);
				const index = at === -1 ? (item.completed ? stages.length - 1 : 0) : at;

				return [
					{
						key: `tsk-${item.taskId}`,
						label: item.title,
						context:
							item.checklistTitle !== null
								? `Task in ${item.checklistTitle}`
								: home !== null
									? `Task in #${home.name}`
									: "Task",
						to,
						taskId: item.taskId,
						stage: {
							name: stages[index].name,
							color: index === 0 ? null : stageColor(stages, index),
						},
					},
				];
			});

		return [...checklists, ...tasks, ...trackers];
	}, [data, query, tags.data]);

	// A new search lights its first result again.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on every change of the words, not of the index behind them.
	useEffect(() => setActive(0), [query]);

	const lit = Math.min(active, Math.max(0, results.length - 1));
	const optionId = (index: number) => `${listId}-${index}`;

	function open(result: Result) {
		onOpenChange(false);
		setQuery("");
		void navigate({
			to: result.to,
			search: { task: result.taskId },
		});
	}

	function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (results.length === 0) return;

		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			const next = (lit + step + results.length) % results.length;
			setActive(next);
			document
				.getElementById(optionId(next))
				?.scrollIntoView({ block: "nearest" });
			return;
		}
		if (event.key === "Home" || event.key === "End") {
			event.preventDefault();
			setActive(event.key === "Home" ? 0 : results.length - 1);
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			open(results[lit]);
		}
	}

	return (
		<FormDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title="Search"
			width={520}
		>
			<VStack gap={3}>
				<TextInput
					autoComplete="off"
					label="Search checklists, tasks and trackers"
					isLabelHidden
					// Opening search is asking to type: the caret is waiting in the
					// box, however it was opened.
					hasAutoFocus
					placeholder="Search checklists, tasks and trackers"
					value={query}
					onChange={setQuery}
					onKeyDown={onKeyDown}
					isLoading={isOpen && isPending}
					role="combobox"
					aria-expanded={results.length > 0}
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={results.length > 0 ? optionId(lit) : undefined}
				/>

				{isError ? (
					<Text color="secondary">Search is unavailable right now.</Text>
				) : query.trim() === "" ? (
					<Text color="secondary">
						Type to search across checklists, tasks and trackers. ↑ ↓ to move,
						Enter to open.
					</Text>
				) : results.length === 0 ? (
					<EmptyState
						isCompact
						title="No matches"
						description={`Nothing matched "${query.trim()}".`}
					/>
				) : (
					<div
						id={listId}
						role="listbox"
						aria-label="Results"
						className="thunderlist-search-results"
					>
						{results.map((result, index) => (
							/*
							 * Chosen with the keys from the box — focus never leaves it —
							 * or with a pointer, which is why an option takes a click
							 * but no focus of its own.
							 */
							// biome-ignore lint/a11y/useKeyWithClickEvents: the keys are the box's; see `onKeyDown`.
							<div
								key={result.key}
								id={optionId(index)}
								role="option"
								aria-selected={index === lit}
								tabIndex={-1}
								className="thunderlist-search-result"
								data-active={index === lit}
								onMouseEnter={() => setActive(index)}
								onClick={() => open(result)}
							>
								<span className="thunderlist-search-label">{result.label}</span>
								<span className="thunderlist-search-context">
									<span>{result.context}</span>
									{result.stage === undefined ? null : (
										<span
											className="thunderlist-search-stage"
											data-first={result.stage.color === null}
											style={
												result.stage.color === null
													? undefined
													: stageColorStyle(result.stage.color)
											}
										>
											<StageDot color={result.stage.color} />
											{result.stage.name}
										</span>
									)}
								</span>
							</div>
						))}
					</div>
				)}
			</VStack>
		</FormDialog>
	);
}
