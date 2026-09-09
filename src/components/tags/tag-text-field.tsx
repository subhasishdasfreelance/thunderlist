import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Token } from "@astryxdesign/core/Token";
import {
	type CSSProperties,
	type KeyboardEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {
	activeTagQuery,
	applyTagSuggestion,
	sameTagName,
	splitTitleTags,
} from "#/lib/tags/inline-tags";
import type { Tag } from "#/schemas/tag";

/** Enough to choose from without the list covering the rows underneath. */
const MAX_SUGGESTIONS = 6;

/** `color: null` marks a name that is not a tag yet. */
type Suggestion = { name: string; color: Tag["color"] | null };

function suggestionsFor(
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
		.map((tag) => ({ name: tag.name, color: tag.color }));

	// Offering the name back means typing a tag that does not exist yet is never
	// a dead end; picking it creates the tag along with the task.
	if (query === "" || tags.some((tag) => sameTagName(tag.name, query))) {
		return matches;
	}

	return [...matches, { name: query, color: null }];
}

/**
 * A text field that completes `#tags` as they are typed.
 *
 * Tagging only happens if it is faster than not bothering, so a tag is written
 * in the same keystrokes as the task itself — "buy milk #shopping" — and the
 * tags that already exist are offered as soon as the `#` is typed. Anything not
 * on the list can still be typed straight through.
 *
 * The suggestion list owns Enter only while it is open, so Enter still submits
 * the moment no tag is being written.
 */
export function TagTextField({
	label,
	placeholder,
	value,
	onChange,
	onSubmit,
	tags,
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

	const query = isDismissed
		? null
		: activeTagQuery(value, Math.min(caret ?? value.length, value.length));
	const suggestions = query === null ? [] : suggestionsFor(query.query, tags);
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
		if (query === null) return;

		const next = applyTagSuggestion(value, query, suggestion.name);
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
			 * Enter completes the tag only when there is something left to
			 * complete. Having typed "#shopping" in full, the user means "add this
			 * task" — making them press Enter twice to say so, once to accept a
			 * word they have already finished, is the wart this avoids.
			 */
			if (isOpen && !sameTagName(suggestions[index].name, query?.query ?? "")) {
				pick(suggestions[index]);
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
				{splitTitleTags(value).map((segment) =>
					segment.kind === "text" ? (
						<span key={segment.at}>{segment.text}</span>
					) : (
						<span
							key={segment.at}
							className="thunderlist-tag"
							data-color={
								tags.find((tag) => sameTagName(tag.name, segment.name))
									?.color ?? "none"
							}
						>
							#{segment.name}
						</span>
					),
				)}
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
				<ul className="thunderlist-suggestions absolute top-full left-0 z-30 mt-1 max-h-60 w-max min-w-40 max-w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-lg">
					{suggestions.map((suggestion, position) => (
						<li key={suggestion.name}>
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
								<Token
									size="sm"
									color={suggestion.color ?? "gray"}
									label={suggestion.name}
								/>
								{suggestion.color === null ? (
									<Text type="supporting">New tag</Text>
								) : null}
							</button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
