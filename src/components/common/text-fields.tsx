import { TextArea as AstryxTextArea } from "@astryxdesign/core/TextArea";
import { TextInput as AstryxTextInput } from "@astryxdesign/core/TextInput";
import type { ComponentProps } from "react";
import { useLatest, useTypedValue } from "#/lib/use-typed-value";

/*
 * Astryx's text fields, quick to type in however much the form around them
 * draws: a keystroke draws the field, and the form hears of it a moment later;
 * see `useTypedValue`. The handlers that may read the form — Enter, leaving
 * the field — get it up to date first, and are the latest ones it gave.
 */

export function TextInput({
	value,
	onChange,
	onEnter,
	onKeyDown,
	onBlur,
	...props
}: ComponentProps<typeof AstryxTextInput>) {
	const typed = useTypedValue(value, onChange);
	const latest = useLatest({ onEnter, onKeyDown, onBlur });

	return (
		<AstryxTextInput
			{...props}
			value={typed.draft}
			onChange={typed.type}
			onEnter={
				onEnter === undefined
					? undefined
					: () => {
							typed.flush();
							latest.current.onEnter?.();
						}
			}
			onKeyDown={(event) => {
				if (event.key === "Enter") typed.flush();
				latest.current.onKeyDown?.(event);
			}}
			onBlur={(event) => {
				typed.flush();
				latest.current.onBlur?.(event);
			}}
		/>
	);
}

export function TextArea({
	value,
	onChange,
	onKeyDown,
	onBlur,
	...props
}: ComponentProps<typeof AstryxTextArea>) {
	const typed = useTypedValue(value, onChange);
	const latest = useLatest({ onKeyDown, onBlur });

	return (
		<AstryxTextArea
			{...props}
			value={typed.draft}
			onChange={typed.type}
			onKeyDown={(event) => {
				if (event.key === "Enter") typed.flush();
				latest.current.onKeyDown?.(event);
			}}
			onBlur={(event) => {
				typed.flush();
				latest.current.onBlur?.(event);
			}}
		/>
	);
}
