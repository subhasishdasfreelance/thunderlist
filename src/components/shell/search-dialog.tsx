import { EmptyState } from "@astryxdesign/core/EmptyState";
import { List, ListItem } from "@astryxdesign/core/List";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { searchIndexQuery } from "#/queries/system";
import { TRACKER_TYPE_LABELS } from "#/schemas/tracker";

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
};

const MAX_PER_GROUP = 6;

function matches(haystack: string, needle: string): boolean {
	return haystack.toLowerCase().includes(needle);
}

export function SearchDialog({
	isOpen,
	onOpenChange,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}) {
	const [query, setQuery] = useState("");
	const navigate = useNavigate();

	// Only loaded once the dialog is opened; filtering happens on the client.
	const { data, isPending, isError } = useQuery({
		...searchIndexQuery(),
		enabled: isOpen,
	});

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
				context: TRACKER_TYPE_LABELS[item.type],
				to: `/trackers/${item.trackerId}`,
			}));

		/*
		 * A task result opens the page the task is actually on and scrolls to it:
		 * its checklist, or — for one that belongs to no checklist — whichever
		 * list is holding it. A task on neither has nowhere to be shown, so it is
		 * not offered rather than opening a page it is not on.
		 */
		const tasks = data.tasks
			.filter((item) => matches(item.title, needle))
			.slice(0, MAX_PER_GROUP)
			.flatMap((item) => {
				const to =
					item.checklistId !== null
						? `/checklists/${item.checklistId}`
						: item.list !== null
							? `/${item.list}`
							: null;

				if (to === null) return [];

				return [
					{
						key: `tsk-${item.taskId}`,
						label: item.title,
						context:
							item.checklistTitle === null
								? "Task"
								: `Task in ${item.checklistTitle}`,
						to,
						taskId: item.taskId,
					},
				];
			});

		return [...checklists, ...tasks, ...trackers];
	}, [data, query]);

	function open(result: Result) {
		onOpenChange(false);
		setQuery("");
		void navigate({
			to: result.to,
			search: { task: result.taskId },
		});
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
					label="Search checklists, tasks and trackers"
					isLabelHidden
					placeholder="Search checklists, tasks and trackers"
					value={query}
					onChange={setQuery}
					isLoading={isOpen && isPending}
				/>

				{isError ? (
					<Text color="secondary">Search is unavailable right now.</Text>
				) : query.trim() === "" ? (
					<Text color="secondary">
						Type to search across checklists, tasks and trackers.
					</Text>
				) : results.length === 0 ? (
					<EmptyState
						isCompact
						title="No matches"
						description={`Nothing matched "${query.trim()}".`}
					/>
				) : (
					<List hasDividers>
						{results.map((result) => (
							<ListItem
								key={result.key}
								label={result.label}
								description={result.context}
								onClick={() => open(result)}
							/>
						))}
					</List>
				)}
			</VStack>
		</FormDialog>
	);
}
