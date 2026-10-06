import { useMediaQuery } from "@astryxdesign/core/hooks";
import { usePopover } from "@astryxdesign/core/Popover";
import {
	type ISOTimeString,
	TimeInput,
	type TimeInputProps,
} from "@astryxdesign/core/TimeInput";
import { type MouseEvent, useEffect, useLayoutEffect, useRef } from "react";
import { formatClock } from "#/lib/format-date";

/** Minutes between the times offered in the list. */
const STEP_MINUTES = 15;

/** Every time of day the list offers, `HH:MM`. */
const TIMES = Array.from({ length: (24 * 60) / STEP_MINUTES }, (_, index) => {
	const minutes = index * STEP_MINUTES;
	const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
	return `${hours}:${String(minutes % 60).padStart(2, "0")}`;
});

/** Where the list opens when there is no time yet: the start of a working day. */
const OPEN_AT_WHEN_EMPTY = "09:00";

/** The time the list opens on: the value's own slot, or the one just before it. */
function slotOf(value: string | undefined): string {
	if (value === undefined) return OPEN_AT_WHEN_EMPTY;
	const [hours, minutes] = value.split(":").map(Number);
	return (
		TIMES[Math.floor((hours * 60 + minutes) / STEP_MINUTES)] ??
		OPEN_AT_WHEN_EMPTY
	);
}

/**
 * A time of day, picked the way a date is.
 *
 * It is Astryx's typed time field, so any minute can still be typed and it
 * always reads "2:30 PM". Clicking it opens a list of times every quarter hour
 * under it, as clicking a date field opens its calendar; picking one fills the
 * field and closes the list.
 *
 * The same field on every screen. On a touch screen the list stands in for the
 * keyboard, so tapping it does not cover the list with one; a phone's own time
 * picker is not used, since it shows its system's clock, often 24-hour.
 *
 * `value` and `onChange` are `HH:MM`, the way times are stored.
 */
export function TimeField({
	value,
	onChange,
	...props
}: Omit<TimeInputProps, "value" | "onChange" | "nativePicker" | "ref"> & {
	value: string | undefined;
	onChange: (value: string | undefined) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const isTouch = useMediaQuery("(pointer: coarse)");
	const popover = usePopover({
		dialogLabel: `${props.label} times`,
		// Focus stays in the field, so the time can still be typed.
		hasAutoFocus: false,
	});
	const { triggerRef, isOpen } = popover;
	const openAt = slotOf(value);

	// The list hangs from the field's box, not from the text inside it.
	useEffect(() => {
		triggerRef(inputRef.current?.parentElement ?? null);
	}, [triggerRef]);

	useEffect(() => {
		if (inputRef.current) inputRef.current.inputMode = isTouch ? "none" : "";
	}, [isTouch]);

	// Opened, the list shows the time it is on, in the middle of the list.
	useLayoutEffect(() => {
		if (!isOpen) return;
		const list = listRef.current;
		const option = list?.querySelector<HTMLElement>(`[data-time="${openAt}"]`);
		if (!list || !option) return;
		list.scrollTop =
			option.offsetTop - list.clientHeight / 2 + option.offsetHeight / 2;
	}, [isOpen, openAt]);

	/** Any click in the field's box opens the list, except on its clear button. */
	function openOnClick(event: MouseEvent<HTMLDivElement>) {
		const target = event.target as HTMLElement;
		const box = inputRef.current?.parentElement;
		if (props.isDisabled || isOpen || !box?.contains(target)) return;
		if (target.closest("button")) return;
		popover.show({ skipAutoFocus: true });
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: the field inside is the control; this only hears its clicks, and it can be typed in from the keyboard.
		<div onClick={openOnClick}>
			<TimeInput
				{...props}
				ref={inputRef}
				nativePicker="never"
				value={value as ISOTimeString | undefined}
				onChange={(time) => onChange(time?.slice(0, 5))}
			/>
			{popover.render(
				// Drawn only while open: ninety-six buttons need not follow each
				// keystroke elsewhere in a form.
				isOpen ? (
					<ul ref={listRef} className="thunderlist-time-list">
						{TIMES.map((time) => (
							<li key={time}>
								<button
									type="button"
									className="thunderlist-time-option"
									data-time={time}
									aria-pressed={time === value}
									onClick={() => {
										onChange(time);
										popover.hide();
									}}
								>
									{formatClock(time).toUpperCase()}
								</button>
							</li>
						))}
					</ul>
				) : null,
				{ placement: "below", alignment: "start" },
			)}
		</div>
	);
}
