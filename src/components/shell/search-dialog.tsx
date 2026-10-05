import { EmptyState } from "@astryxdesign/core/EmptyState";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type KeyboardEvent, useEffect, useId, useMemo, useState } from "react";
import { FormDialog } from "#/components/common/form-dialog";
import { SectionSpinner } from "#/components/common/section-spinner";
import { StageDot, stageColorStyle } from "#/components/common/stage-dot";
import { TextInput } from "#/components/common/text-fields";
import { countdownsQuery } from "#/queries/countdowns";
import { plansQuery } from "#/queries/plans";
import { groupsQuery } from "#/queries/space";
import { searchIndexQuery } from "#/queries/system";
import { tagsQuery } from "#/queries/tags";
import { type Result, searchResults } from "./search-results";

/**
 * Search, from the keyboard as much as the pointer.
 *
 * The box is a combobox over the results: ↑ and ↓ move through them, Enter
 * opens the one lit, and Esc leaves the box and then closes the dialog. Focus
 * never leaves the box: the lit result is announced from it, as a combobox
 * does.
 *
 * Anything can be found by its number as well as its name; see
 * `searchResults`.
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
	// Tags are found themselves, and are where a task in no checklist is shown.
	const tags = useQuery({ ...tagsQuery(), enabled: isOpen });
	const plans = useQuery({ ...plansQuery(), enabled: isOpen });
	const countdowns = useQuery({ ...countdownsQuery(), enabled: isOpen });
	const groups = useQuery({ ...groupsQuery(), enabled: isOpen });
	// Until the index and the tags are here, no result is not the same as no
	// match. The rest join in as they arrive.
	const isSearching = isOpen && (isPending || tags.isPending);

	const results = useMemo<Array<Result>>(
		() =>
			data === undefined
				? []
				: searchResults(query, {
						index: data,
						tags: tags.data ?? [],
						plans: plans.data ?? [],
						countdowns: countdowns.data ?? [],
						groups: groups.data ?? [],
					}),
		[data, query, tags.data, plans.data, countdowns.data, groups.data],
	);

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
			search: { ...result.focus },
			/*
			 * New every time. The router treats going where you already are as
			 * no move at all — no history entry, so no new arrival — and a task
			 * searched for twice, or from the page it was last found on, was then
			 * neither scrolled to nor ringed; see `useArrival`.
			 */
			state: { searchedAt: Date.now() },
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
					/*
					 * A search field, not a text one: Chrome on Android draws its bar
					 * of saved passwords, cards and addresses over any text field, but
					 * not over a search field with nothing to suggest; see
					 * `NumberField`. Set from the first render rather than stamped
					 * afterwards (`useNoAutofill`), since this box takes focus the
					 * moment it is drawn — before a stamp would reach it. Astryx types
					 * `type` narrowly but hands it to the `<input>` as it is.
					 */
					type={"search" as "text"}
					autoComplete="off"
					label="Search by name or number"
					isLabelHidden
					// Opening search is asking to type: the caret is waiting in the
					// box, however it was opened.
					hasAutoFocus
					enterKeyHint="search"
					placeholder="Search by name or number, like T-42"
					value={query}
					onChange={setQuery}
					onKeyDown={onKeyDown}
					isLoading={isSearching}
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
						Type to search across checklists, tasks and trackers.{" "}
						<span className="thunderlist-keyboard-only">
							↑ ↓ to move, Enter to open.
						</span>
					</Text>
				) : isSearching ? (
					<SectionSpinner label="Searching…" />
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
								<span className="thunderlist-search-label">
									{result.number === undefined ? null : (
										<span className="thunderlist-number">{result.number}</span>
									)}
									{result.label}
								</span>
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
