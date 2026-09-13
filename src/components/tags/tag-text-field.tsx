import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Token } from "@astryxdesign/core/Token";
import { ListChecks, TrendingUp } from "lucide-react";
import {
	type CSSProperties,
	type KeyboardEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { TagSegments } from "#/components/tags/tag-segments";
import {
	activeTagQuery,
	activeTrackerQuery,
	applyTagSuggestion,
	applyTrackerSuggestion,
	sameTagName,
	sameTrackerName,
} from "#/lib/tags/inline-tags";
import type { Checklist } from "#/schemas/checklist";
import type { Tag } from "#/schemas/tag";
import type { TrackerSummary } from "#/schemas/tracker";

/** Enough to choose from without the list covering the rows underneath. */
const MAX_SUGGESTIONS = 6;

/**
 * One offer in the list.
 *
 * `kind` says which mark it completes, because they are picked and drawn
 * differently: a tag can be invented as it is typed and shows as a coloured
 * token, while a tracker or a checklist has to already exist and shows as its
 * own title. `color: null` marks a name that is not a tag yet.
 */
type Suggestion =
	| { kind: "tag"; name: string; color: Tag["color"] | null }
	| { kind: "tracker"; name: string }
	| { kind: "checklist"; name: string };

function tagSuggestions(
	query: string,
	tags: ReadonlyArray<Tag>,
): Array<Suggestion> {
	const lower = query.toLowerCase();

	const matches = tags
		.filter((tag) => tag.name.toLowerCase().includes(lower))
		// A tag that starts with what was typed is the likelier one.
		.sort((a, b) => {
			const aStarts = a.name.toLowerCase().startsWith(lower);
			const bStarts = b.name.toLowerCase().startsWith(lower);
			if (aStarts !== bStarts) return aStarts ? -1 : 1;
			return a.name.localeCompare(b.name);
		})
		.slice(0, MAX_SUGGESTIONS)
		.map(
			(tag): Suggestion => ({
				kind: "tag",
				name: tag.name,
				color: tag.color,
			}),
		);

	// Offering the name back means typing a tag that does not exist yet is never
	// a dead end; picking it creates the tag along with the task.
	if (query === "" || tags.some((tag) => sameTagName(tag.name, query))) {
		return matches;
	}

	return [...matches, { kind: "tag", name: query, color: null }];
}

/**
 * The trackers and checklists whose titles contain what has been typed.
 *
 * Both answer to `&`, so both are searched together, anywhere in the title.
 * No "create it" offer at the end, unlike tags: a tracker has a target, a unit
 * and a deadline, and a checklist has tasks, none of which fit on this line.
 * An unmatched name stays ordinary text and the task is an ordinary task.
 */
function linkSuggestions(
	query: string,
	trackers: ReadonlyArray<TrackerSummary>,
	checklists: ReadonlyArray<Pick<Checklist, "title">>,
): Array<Suggestion> {
	const lower = query.trim().toLowerCase();

	const candidates: Array<Suggestion> = [
		...trackers.map(
			(tracker): Suggestion => ({ kind: "tracker", name: tracker.title }),
		),
		...checklists.map(
			(checklist): Suggestion => ({ kind: "checklist", name: checklist.title }),
		),
	];

	return (
		candidates
			.filter((candidate) => candidate.name.toLowerCase().includes(lower))
			// A line is matched by name, so two of a kind with one title are one
			// pick, not two.
			.filter(
				(candidate, index, all) =>
					all.findIndex(
						(other) =>
							other.kind === candidate.kind &&
							sameTrackerName(other.name, candidate.name),
					) === index,
			)
			.sort((a, b) => {
				const aStarts = a.name.toLowerCase().startsWith(lower);
				const bStarts = b.name.toLowerCase().startsWith(lower);
				if (aStarts !== bStarts) return aStarts ? -1 : 1;
				return a.name.localeCompare(b.name);
			})
			.slice(0, MAX_SUGGESTIONS)
	);
}

/**
 * A text field that completes `#tags`, and `&trackers` and `&checklists`, as
 * they are typed.
 *
 * Tagging only happens if it is faster than not bothering, so a tag is written
 * in the same keystrokes as the task itself — "buy milk #shopping" — and the
 * tags that already exist are offered as soon as the `#` is typed. Anything not
 * on the list can still be typed straight through.
 *
 * A line beginning `&` names a tracker or a checklist instead, and completes
 * the same way. It claims the whole line, because their titles are real titles
 * with spaces in them — so the two marks never compete for the same keystrokes
 * and only one list can be open at a time.
 *
 * The suggestion list owns Enter only while it is open, so Enter still submits
 * the moment nothing is being written.
 */
export function TagTextField({
	label,
	placeholder,
	value,
	onChange,
	onSubmit,
	tags,
	trackers = [],
	checklists = [],
	multiline = false,
	rows,
	hasAutoFocus = false,
}: {
	label: string;
	placeholder?: string;
	value: string;
	onChange: (value: string) => void;
	/** Enter, when no suggestion is being chosen. */
	onSubmit: () => void;
	tags: ReadonlyArray<Tag>;
	/** Every tracker, for completing a line that begins `&`. */
	trackers?: ReadonlyArray<TrackerSummary>;
	/** The checklists a line beginning `&` may also name. */
	checklists?: ReadonlyArray<Pick<Checklist, "checklistId" | "title">>;
	multiline?: boolean;
	rows?: number;
	hasAutoFocus?: boolean;
}) {
	const fieldRef = useRef<(HTMLTextAreaElement & HTMLInputElement) | null>(
		null,
	);
	const [active, setActive] = useState(0);
	/**
	 * Where the caret is, tracked rather than read from the element: during
	 * render the DOM still holds the previous value, so reading it there would
	 * leave the suggestions one keystroke behind.
	 */
	const [caret, setCaret] = useState<number | null>(null);
	/** Escape closes the list until the next keystroke. */
	const [isDismissed, setIsDismissed] = useState(false);

	const at = Math.min(caret ?? value.length, value.length);

	/*
	 * A tracker line is checked first and wins outright. `&` claims its whole
	 * line, so anything typed on it — a `#` included — is part of a tracker's
	 * title rather than a tag, and offering both lists at once would be a lie
	 * about what Enter is going to do.
	 */
	const trackerQuery = isDismissed ? null : activeTrackerQuery(value, at);
	const tagQuery =
		isDismissed || trackerQuery !== null ? null : activeTagQuery(value, at);

	const suggestions =
		trackerQuery !== null
			? linkSuggestions(trackerQuery.query, trackers, checklists)
			: tagQuery !== null
				? tagSuggestions(tagQuery.query, tags)
				: [];
	const isOpen = suggestions.length > 0;
	const index = Math.min(active, Math.max(suggestions.length - 1, 0));

	/** Keep the tracked caret in step with the element after it has moved. */
	const syncCaret = () => setCaret(fieldRef.current?.selectionStart ?? null);

	function handleChange(
		next: string,
		event: { target: { selectionStart: number | null } },
	) {
		setCaret(event.target.selectionStart ?? next.length);
		setIsDismissed(false);
		setActive(0);
		onChange(next);
	}

	function pick(suggestion: Suggestion) {
		const next =
			suggestion.kind !== "tag"
				? trackerQuery === null
					? null
					: applyTrackerSuggestion(value, trackerQuery, suggestion.name)
				: tagQuery === null
					? null
					: applyTagSuggestion(value, tagQuery, suggestion.name);

		if (next === null) return;

		// A tracker is the whole line, so picking one finishes it and the list has
		// nothing left to offer. A tag can be followed by another, so that list
		// stays up. Typing again reopens either.
		if (suggestion.kind !== "tag") setIsDismissed(true);

		onChange(next.text);
		setCaret(next.caret);
		setActive(0);

		// React would otherwise leave the caret at the end of the new value.
		requestAnimationFrame(() => {
			fieldRef.current?.focus();
			fieldRef.current?.setSelectionRange(next.caret, next.caret);
		});
	}

	function handleKeyDown(
		event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
	) {
		if (isOpen && event.key === "Escape") {
			event.preventDefault();
			setIsDismissed(true);
			return;
		}

		if (isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			setActive(
				(current) => (current + step + suggestions.length) % suggestions.length,
			);
			return;
		}

		// Tab is only ever a completion, so it always takes the suggestion.
		if (event.key === "Tab" && isOpen) {
			event.preventDefault();
			pick(suggestions[index]);
			return;
		}

		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();

			/*
			 * Enter completes only when there is something left to complete.
			 * Having typed "#shopping" or "&Dune" in full, the user means "add
			 * this task" — making them press Enter twice to say so, once to
			 * accept a word they have already finished, is the wart this avoids.
			 */
			const typed = (trackerQuery ?? tagQuery)?.query ?? "";
			const highlighted = suggestions[index];
			const isFinished =
				highlighted !== undefined &&
				(highlighted.kind !== "tag"
					? sameTrackerName(highlighted.name, typed)
					: sameTagName(highlighted.name, typed));

			if (isOpen && !isFinished) {
				pick(highlighted);
				return;
			}

			onSubmit();
		}
	}

	/*
	 * The highlight layer sits behind the field, drawing the same text with the
	 * tags picked out, while the field itself renders its text transparently.
	 * The two only line up if the layer copies the field's box exactly, so the
	 * geometry is read off the live element rather than guessed at.
	 */
	const mirrorRef = useRef<HTMLDivElement | null>(null);
	const [mirrorStyle, setMirrorStyle] = useState<CSSProperties>({});

	useLayoutEffect(() => {
		const field = fieldRef.current;
		if (!field) return;

		const measure = () => {
			const cs = getComputedStyle(field);
			setMirrorStyle({
				top: field.offsetTop,
				left: field.offsetLeft,
				width: field.offsetWidth,
				height: field.offsetHeight,
				font: cs.font,
				letterSpacing: cs.letterSpacing,
				wordSpacing: cs.wordSpacing,
				textIndent: cs.textIndent,
				textTransform: cs.textTransform as CSSProperties["textTransform"],
				lineHeight: cs.lineHeight,
				padding: cs.padding,
				borderWidth: cs.borderWidth,
				borderStyle: "solid",
				borderColor: "transparent",
				textAlign: cs.textAlign as CSSProperties["textAlign"],
			});
		};

		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(field);
		return () => observer.disconnect();
	}, []);

	// A long value scrolls inside the field; the layer has to scroll with it.
	useEffect(() => {
		const field = fieldRef.current;
		const mirror = mirrorRef.current;
		if (!field || !mirror) return;

		const sync = () => {
			mirror.scrollTop = field.scrollTop;
			mirror.scrollLeft = field.scrollLeft;
		};

		sync();
		field.addEventListener("scroll", sync);
		return () => field.removeEventListener("scroll", sync);
	}, []);

	const shared = {
		label,
		isLabelHidden: true,
		placeholder,
		value,
		onChange: handleChange,
		onKeyDown: handleKeyDown,
		onKeyUp: syncCaret,
		onClick: syncCaret,
		hasAutoFocus,
		width: "100%" as const,
	};

	return (
		<div className="thunderlist-field relative w-full">
			{/*
			 * Behind the field, showing the tags in colour. Hidden from assistive
			 * technology and from the pointer: the field itself is the control, and
			 * this is only its paint.
			 */}
			<div
				ref={mirrorRef}
				aria-hidden
				className="thunderlist-mirror"
				style={mirrorStyle}
			>
				<TagSegments title={value} tags={tags} />
				{/* A trailing newline needs a line to sit on, or the last row is lost. */}
				{"​"}
			</div>

			{multiline ? (
				<TextArea {...shared} rows={rows} ref={fieldRef} />
			) : (
				<TextInput {...shared} ref={fieldRef} />
			)}

			{isOpen ? (
				// Not a listbox: the field keeps focus and the caret throughout, so
				// this is a hint about what is being typed rather than a control.
				<ul className="thunderlist-suggestions absolute top-full left-0 z-30 mt-1 max-h-60 w-max min-w-40 max-w-full overflow-y-auto rounded-lg border border-border py-1 shadow-lg">
					{suggestions.map((suggestion, position) => (
						<li key={`${suggestion.kind}:${suggestion.name}`}>
							<button
								type="button"
								className={`flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left ${
									position === index ? "bg-overlay-hover" : ""
								}`}
								// The field must not lose focus, or the caret goes with it.
								onMouseDown={(event) => event.preventDefault()}
								onMouseEnter={() => setActive(position)}
								onClick={() => pick(suggestion)}
							>
								{suggestion.kind !== "tag" ? (
									<>
										<Icon
											icon={
												suggestion.kind === "tracker" ? TrendingUp : ListChecks
											}
											size="sm"
											color="secondary"
										/>
										<Text>{suggestion.name}</Text>
									</>
								) : (
									<>
										<Token
											size="sm"
											color={suggestion.color ?? "gray"}
											label={suggestion.name}
										/>
										{suggestion.color === null ? (
											<Text type="supporting">New tag</Text>
										) : null}
									</>
								)}
							</button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
