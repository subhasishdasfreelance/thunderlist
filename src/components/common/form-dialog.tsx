import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import {
	type FormEvent,
	type ReactNode,
	useEffect,
	useId,
	useRef,
} from "react";

/**
 * The shell every dialog in the app is built from.
 *
 * `DialogHeader` is a `LayoutHeader` underneath, and takes its padding from the
 * Layout it sits in. Content placed beside it as a plain stack gets the
 * dialog's outer padding instead, which is why a hand-rolled body sits visibly
 * further left than its own title. Putting the header, the body and the actions
 * in the three Layout slots is what makes them share one content box — and it
 * is `LayoutContent` that gives a long body somewhere to scroll, rather than
 * letting it run off the bottom of the screen.
 *
 * Doing this once, here, is the only way the alignment stays right across every
 * dialog rather than being re-derived, and re-broken, in each one.
 */
export function FormDialog({
	isOpen,
	onOpenChange,
	title,
	subtitle,
	width = 480,
	onSubmit,
	actions,
	children,
}: {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	title: string;
	subtitle?: string;
	width?: number;
	/** When given, the body becomes a form; see `actions` for submitting it. */
	onSubmit?: (event: FormEvent) => void;
	/**
	 * Buttons for the footer, which stays put while the body scrolls.
	 *
	 * The footer sits outside the form element, so a submit button is handed the
	 * form's id and wired back to it with `form={formId}` rather than by nesting.
	 */
	actions?: (formId: string) => ReactNode;
	children: ReactNode;
}) {
	const formId = useId();
	const actionsRef = useRef<HTMLDivElement>(null);

	/*
	 * Ctrl+Enter (⌘+Enter on a Mac) saves, from anywhere in the dialog — a
	 * textarea included, where Enter alone is a new line. It presses the form's
	 * submit button, or else the last button in the footer, which is where every
	 * dialog here puts the thing it is for. A disabled button stays unpressed,
	 * as it would to a click.
	 */
	useEffect(() => {
		if (!isOpen) return;

		function onKeyDown(event: KeyboardEvent) {
			if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
			const actions = actionsRef.current;
			const dialog = actions?.closest("dialog");
			// Only the dialog being typed in; one opened over another has its own.
			if (!actions || !dialog?.contains(event.target as Node)) return;

			event.preventDefault();
			const buttons = [...actions.querySelectorAll("button")];
			const save =
				buttons.find((button) => button.type === "submit") ?? buttons.at(-1);
			if (
				save === undefined ||
				save.disabled ||
				save.getAttribute("aria-disabled") === "true"
			) {
				return;
			}
			save.click();
		}

		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [isOpen]);

	return (
		<Dialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			/*
			 * Clicking away closes it, the same as Escape. `form` would hold the
			 * dialog open once anything had been typed, to protect the draft — but
			 * a dialog that ignores the click is read as a stuck one, and every
			 * form here is short enough to retype.
			 */
			purpose="info"
			width={width}
		>
			<Layout
				header={
					<DialogHeader
						// The subtitle is one line; see `.thunderlist-dialog-header`.
						className="thunderlist-dialog-header"
						title={title}
						subtitle={subtitle}
						onOpenChange={onOpenChange}
					/>
				}
				content={
					<LayoutContent>
						{onSubmit ? (
							/*
							 * Nothing in this app is a credential, an address or a card,
							 * and some browsers decide that per form rather than per
							 * field; see `src/types/astryx-autofill.d.ts`.
							 */
							<form id={formId} autoComplete="off" onSubmit={onSubmit}>
								{children}
							</form>
						) : (
							children
						)}
					</LayoutContent>
				}
				footer={
					actions ? (
						<LayoutFooter>
							<div ref={actionsRef} className="thunderlist-dialog-actions">
								{actions(formId)}
							</div>
						</LayoutFooter>
					) : undefined
				}
			/>
		</Dialog>
	);
}
