import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { type FormEvent, type ReactNode, useId } from "react";

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

	return (
		<Dialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			purpose="form"
			width={width}
		>
			<Layout
				header={
					<DialogHeader
						title={title}
						subtitle={subtitle}
						onOpenChange={onOpenChange}
					/>
				}
				content={
					<LayoutContent>
						{onSubmit ? (
							<form id={formId} onSubmit={onSubmit}>
								{children}
							</form>
						) : (
							children
						)}
					</LayoutContent>
				}
				footer={
					actions ? <LayoutFooter>{actions(formId)}</LayoutFooter> : undefined
				}
			/>
		</Dialog>
	);
}
